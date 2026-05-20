"""Video analysis module - frame extraction, object detection, tracking, classification."""

import math
import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy as np

from shared.config import settings
from shared.logging import get_logger
from shared.models.video import (
    AccidentClassification,
    AccidentType,
    BoundingBox,
    DetectionResult,
    FrameData,
    TrackPoint,
    TrafficLightState,
    VehicleTrack,
    VideoAnalysisResult,
    VideoMetadata,
)

logger = get_logger(__name__)


class VideoAnalyzer:
    """Analyzes dashcam video for accident detection and classification."""

    def __init__(self) -> None:
        self._yolo_model = None
        self._tracker = None

    def _load_yolo(self):
        """Lazy-load YOLOv8 model."""
        if self._yolo_model is None:
            from ultralytics import YOLO
            self._yolo_model = YOLO("yolov8n.pt")
            logger.info("yolo_model_loaded", device=self._yolo_model.device)

    def extract_frames(self, video_path: str, fps: int | None = None) -> tuple[list[FrameData], VideoMetadata]:
        """Extract keyframes from video at specified FPS using FFmpeg."""
        fps = fps or settings.video_extract_fps
        logger.info("frame_extraction_start", video_path=video_path, fps=fps)

        # Get video metadata
        metadata = self._get_video_metadata(video_path)

        # Validate resolution
        if metadata.height < settings.video_min_resolution:
            raise ValueError(
                f"Video resolution {metadata.width}x{metadata.height} below minimum "
                f"{settings.video_min_resolution}p"
            )

        # Extract frames using FFmpeg
        output_dir = tempfile.mkdtemp(prefix="frames_")
        output_pattern = str(Path(output_dir) / "frame_%06d.jpg")

        cmd = [
            "ffmpeg", "-i", video_path,
            "-vf", f"fps={fps}",
            "-q:v", "2",
            output_pattern,
            "-y", "-loglevel", "error",
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg frame extraction failed: {result.stderr}")

        # Collect extracted frames
        frames = []
        frame_files = sorted(Path(output_dir).glob("frame_*.jpg"))
        for i, frame_path in enumerate(frame_files):
            timestamp = i / fps
            frames.append(FrameData(frame_id=i, timestamp=timestamp, image_path=str(frame_path)))

        logger.info("frame_extraction_complete", frame_count=len(frames), expected=math.ceil(metadata.duration * fps))
        return frames, metadata

    def detect_objects(self, frames: list[FrameData]) -> list[DetectionResult]:
        """Run YOLOv8 object detection on extracted frames."""
        self._load_yolo()
        logger.info("object_detection_start", frame_count=len(frames))

        # Target classes for traffic analysis
        target_classes = {"car", "truck", "bus", "motorcycle", "traffic light"}

        detections = []
        for frame in frames:
            img = cv2.imread(frame.image_path)
            if img is None:
                detections.append(DetectionResult(frame_id=frame.frame_id, timestamp=frame.timestamp, objects=[]))
                continue

            results = self._yolo_model(img, verbose=False, conf=settings.yolo_confidence_threshold)

            objects = []
            for r in results:
                for box in r.boxes:
                    class_name = r.names[int(box.cls)]
                    if class_name not in target_classes:
                        continue

                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    objects.append(BoundingBox(
                        x1=x1, y1=y1, x2=x2, y2=y2,
                        confidence=float(box.conf),
                        class_name=class_name,
                        class_id=int(box.cls),
                    ))

            detections.append(DetectionResult(
                frame_id=frame.frame_id,
                timestamp=frame.timestamp,
                objects=objects,
            ))

        logger.info("object_detection_complete", total_detections=sum(len(d.objects) for d in detections))
        return detections

    def track_vehicles(self, detections: list[DetectionResult]) -> list[VehicleTrack]:
        """Track vehicles across frames using ByteTrack via supervision."""
        import supervision as sv

        logger.info("vehicle_tracking_start", frame_count=len(detections))

        tracker = sv.ByteTrack(
            track_activation_threshold=0.3,
            minimum_matching_threshold=0.2,
            minimum_consecutive_frames=1,
            lost_track_buffer=30,
        )

        # Collect all tracks
        tracks_dict: dict[int, list[TrackPoint]] = {}
        vehicle_classes = {"car", "truck", "bus", "motorcycle"}

        for detection in detections:
            # Filter vehicle detections only
            vehicle_boxes = [obj for obj in detection.objects if obj.class_name in vehicle_classes]

            if not vehicle_boxes:
                # Feed empty detection to tracker to maintain state
                empty_det = sv.Detections.empty()
                tracker.update_with_detections(empty_det)
                continue

            # Convert to supervision format
            xyxy = np.array([[b.x1, b.y1, b.x2, b.y2] for b in vehicle_boxes])
            confidence = np.array([b.confidence for b in vehicle_boxes])
            class_ids = np.array([b.class_id for b in vehicle_boxes])

            sv_detections = sv.Detections(
                xyxy=xyxy,
                confidence=confidence,
                class_id=class_ids,
            )

            tracked = tracker.update_with_detections(sv_detections)

            if tracked.tracker_id is None:
                continue

            for i, tracker_id in enumerate(tracked.tracker_id):
                tid = int(tracker_id)
                bbox = BoundingBox(
                    x1=float(tracked.xyxy[i][0]),
                    y1=float(tracked.xyxy[i][1]),
                    x2=float(tracked.xyxy[i][2]),
                    y2=float(tracked.xyxy[i][3]),
                    confidence=float(tracked.confidence[i]) if tracked.confidence is not None else 0.5,
                    class_name=vehicle_boxes[min(i, len(vehicle_boxes) - 1)].class_name,
                    class_id=int(tracked.class_id[i]) if tracked.class_id is not None else 0,
                )
                center_x = (bbox.x1 + bbox.x2) / 2
                center_y = (bbox.y1 + bbox.y2) / 2

                point = TrackPoint(
                    frame_id=detection.frame_id,
                    timestamp=detection.timestamp,
                    bbox=bbox,
                    center_x=center_x,
                    center_y=center_y,
                )

                if tid not in tracks_dict:
                    tracks_dict[tid] = []
                tracks_dict[tid].append(point)

        # Build VehicleTrack objects, filter by minimum frames
        vehicle_tracks = []
        for vid, points in tracks_dict.items():
            if len(points) >= settings.tracking_min_frames:
                vehicle_tracks.append(VehicleTrack(
                    vehicle_id=vid,
                    track_points=points,
                    first_seen=points[0].timestamp,
                    last_seen=points[-1].timestamp,
                ))

        # Fallback: if ByteTrack fails to produce tracks but detections exist,
        # create synthetic tracks from detection clusters (frame-by-frame)
        if not vehicle_tracks and detections:
            vehicle_tracks = self._fallback_tracking(detections)

        logger.info("vehicle_tracking_complete", tracked_vehicles=len(vehicle_tracks))
        return vehicle_tracks

    def _fallback_tracking(self, detections: list[DetectionResult]) -> list[VehicleTrack]:
        """Fallback tracking when ByteTrack fails - group detections by proximity."""
        vehicle_classes = {"car", "truck", "bus", "motorcycle"}
        all_vehicle_dets = []

        for det in detections:
            for obj in det.objects:
                if obj.class_name in vehicle_classes:
                    all_vehicle_dets.append((det.frame_id, det.timestamp, obj))

        if not all_vehicle_dets:
            return []

        # Simple approach: assign sequential IDs to distinct spatial clusters
        # Group by approximate x-position (left/center/right thirds of frame)
        tracks_by_region: dict[str, list[TrackPoint]] = {"left": [], "center": [], "right": []}

        for frame_id, timestamp, obj in all_vehicle_dets:
            center_x = (obj.x1 + obj.x2) / 2
            center_y = (obj.y1 + obj.y2) / 2
            point = TrackPoint(frame_id=frame_id, timestamp=timestamp, bbox=obj, center_x=center_x, center_y=center_y)

            # Determine region based on frame width (assume ~1920)
            if center_x < 640:
                tracks_by_region["left"].append(point)
            elif center_x < 1280:
                tracks_by_region["center"].append(point)
            else:
                tracks_by_region["right"].append(point)

        vehicle_tracks = []
        vid = 1
        for region, points in tracks_by_region.items():
            if len(points) >= 2:
                vehicle_tracks.append(VehicleTrack(
                    vehicle_id=vid,
                    track_points=sorted(points, key=lambda p: p.timestamp),
                    first_seen=min(p.timestamp for p in points),
                    last_seen=max(p.timestamp for p in points),
                ))
                vid += 1

        logger.info("fallback_tracking_used", tracked_vehicles=len(vehicle_tracks))
        return vehicle_tracks

    def classify_accident(
        self,
        tracks: list[VehicleTrack],
        traffic_lights: list[TrafficLightState] | None = None,
    ) -> AccidentClassification:
        """Classify accident type based on vehicle trajectories (rule-based)."""
        logger.info("accident_classification_start", vehicle_count=len(tracks))

        if len(tracks) < 1:
            return AccidentClassification(
                accident_type=AccidentType.UNKNOWN,
                confidence=0.0,
                details="Insufficient vehicle tracks for classification",
            )

        # Ego vehicle (id=0) is always involved - represented by camera position
        involved_vehicles = [0] + [t.vehicle_id for t in tracks]

        # Analyze relative motion patterns
        classification = self._rule_based_classification(tracks, traffic_lights)
        classification.involved_vehicles = involved_vehicles

        logger.info(
            "accident_classification_complete",
            type=classification.accident_type,
            confidence=classification.confidence,
        )
        return classification

    def _rule_based_classification(
        self,
        tracks: list[VehicleTrack],
        traffic_lights: list[TrafficLightState] | None = None,
    ) -> AccidentClassification:
        """Apply rule-based accident classification logic."""
        # Check for signal violation first (if traffic light data available)
        if traffic_lights:
            red_lights = [tl for tl in traffic_lights if tl.state == "red"]
            if red_lights:
                return AccidentClassification(
                    accident_type=AccidentType.SIGNAL_VIOLATION,
                    confidence=0.7,
                    collision_timestamp=red_lights[0].timestamp,
                    details="Vehicle detected proceeding through red signal",
                )

        # Analyze approach patterns for the closest vehicle to ego
        if tracks:
            primary_track = tracks[0]  # Closest/most relevant vehicle
            points = primary_track.track_points

            if len(points) >= 3:
                # Check if vehicle is approaching (getting larger in frame = getting closer)
                sizes = [(p.bbox.x2 - p.bbox.x1) * (p.bbox.y2 - p.bbox.y1) for p in points]
                size_growth = sizes[-1] / max(sizes[0], 1.0)

                # Check vertical position (approaching from ahead vs behind)
                y_positions = [p.center_y for p in points]
                y_trend = y_positions[-1] - y_positions[0]

                # Rapid approach from ahead (rear-end by ego or being rear-ended)
                if size_growth > 2.0 and y_trend > 0:
                    return AccidentClassification(
                        accident_type=AccidentType.REAR_END,
                        confidence=0.6,
                        collision_timestamp=points[-1].timestamp,
                        details="Rapid approach detected - potential rear-end collision",
                    )

                # Lateral movement (lane change)
                x_positions = [p.center_x for p in points]
                x_range = max(x_positions) - min(x_positions)
                frame_width = max(p.bbox.x2 for p in points)
                if x_range > frame_width * 0.3:
                    return AccidentClassification(
                        accident_type=AccidentType.LANE_CHANGE,
                        confidence=0.5,
                        collision_timestamp=points[-1].timestamp,
                        details="Significant lateral movement detected - potential lane change collision",
                    )

                # Head-on (vehicle approaching from opposite direction)
                if size_growth > 3.0 and abs(y_trend) < 50:
                    return AccidentClassification(
                        accident_type=AccidentType.HEAD_ON,
                        confidence=0.5,
                        collision_timestamp=points[-1].timestamp,
                        details="Vehicle rapidly approaching head-on",
                    )

        return AccidentClassification(
            accident_type=AccidentType.UNKNOWN,
            confidence=0.0,
            details="Unable to determine accident type from available data",
        )

    def analyze(self, video_path: str, job_id: str) -> VideoAnalysisResult:
        """Run complete video analysis pipeline."""
        logger.info("video_analysis_start", job_id=job_id, video_path=video_path)

        # Step 1: Extract frames
        frames, metadata = self.extract_frames(video_path)

        # Step 2: Detect objects
        detections = self.detect_objects(frames)

        # Validate: check if vehicles detected
        vehicle_classes = {"car", "truck", "bus", "motorcycle"}
        frames_with_vehicles = sum(
            1 for d in detections
            if any(obj.class_name in vehicle_classes for obj in d.objects)
        )
        if frames_with_vehicles < len(detections) * 0.2:
            raise ValueError("NO_VEHICLE: Vehicles detected in less than 20% of frames")

        # Extract traffic light states
        traffic_lights = self._extract_traffic_lights(detections)

        # Step 3: Track vehicles
        vehicle_tracks = self.track_vehicles(detections)

        # Step 4: Classify accident
        accident = self.classify_accident(vehicle_tracks, traffic_lights)

        result = VideoAnalysisResult(
            job_id=job_id,
            video_duration=metadata.duration,
            total_frames=len(frames),
            fps_extracted=settings.video_extract_fps,
            detections=detections,
            vehicle_tracks=vehicle_tracks,
            traffic_lights=traffic_lights,
            accident=accident,
            metadata=metadata,
            ego_vehicle_id=0,
        )

        logger.info("video_analysis_complete", job_id=job_id, accident_type=accident.accident_type)
        return result

    def _get_video_metadata(self, video_path: str) -> VideoMetadata:
        """Extract video metadata using FFprobe."""
        cmd = [
            "ffprobe", "-v", "quiet", "-print_format", "json",
            "-show_format", "-show_streams", video_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            raise RuntimeError(f"CORRUPTED_VIDEO: Cannot read video metadata: {result.stderr}")

        import json
        probe = json.loads(result.stdout)

        video_stream = next(
            (s for s in probe.get("streams", []) if s.get("codec_type") == "video"),
            None,
        )
        if not video_stream:
            raise RuntimeError("CORRUPTED_VIDEO: No video stream found")

        duration = float(probe.get("format", {}).get("duration", 0))
        width = int(video_stream.get("width", 0))
        height = int(video_stream.get("height", 0))

        # Parse FPS from r_frame_rate (e.g., "30/1")
        fps_str = video_stream.get("r_frame_rate", "30/1")
        num, den = fps_str.split("/")
        fps = float(num) / float(den)

        codec = video_stream.get("codec_name", "")

        return VideoMetadata(duration=duration, width=width, height=height, fps=fps, codec=codec)

    def _extract_traffic_lights(self, detections: list[DetectionResult]) -> list[TrafficLightState]:
        """Extract traffic light states from detection results."""
        traffic_lights = []
        for det in detections:
            for obj in det.objects:
                if obj.class_name == "traffic light":
                    # Determine state based on color analysis (simplified)
                    state = "unknown"  # Would need color analysis in production
                    traffic_lights.append(TrafficLightState(
                        frame_id=det.frame_id,
                        timestamp=det.timestamp,
                        state=state,
                        confidence=obj.confidence,
                        bbox=obj,
                    ))
        return traffic_lights
