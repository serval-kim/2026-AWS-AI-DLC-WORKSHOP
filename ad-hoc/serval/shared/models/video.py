"""Video analysis domain models."""

from enum import StrEnum

from pydantic import BaseModel, Field


class FrameData(BaseModel):
    """Extracted frame information."""

    frame_id: int
    timestamp: float  # seconds in video
    image_path: str


class BoundingBox(BaseModel):
    """Object detection bounding box."""

    x1: float = Field(ge=0.0)
    y1: float = Field(ge=0.0)
    x2: float = Field(ge=0.0)
    y2: float = Field(ge=0.0)
    confidence: float = Field(ge=0.0, le=1.0)
    class_name: str
    class_id: int


class DetectionResult(BaseModel):
    """Detection results for a single frame."""

    frame_id: int
    timestamp: float
    objects: list[BoundingBox] = Field(default_factory=list)


class TrackPoint(BaseModel):
    """Single point in a vehicle trajectory."""

    frame_id: int
    timestamp: float
    bbox: BoundingBox
    center_x: float
    center_y: float


class VehicleTrack(BaseModel):
    """Tracked vehicle trajectory across frames."""

    vehicle_id: int
    track_points: list[TrackPoint] = Field(default_factory=list)
    first_seen: float = 0.0
    last_seen: float = 0.0


class TrafficLightState(BaseModel):
    """Traffic light state at a specific frame."""

    frame_id: int
    timestamp: float
    state: str  # "red", "yellow", "green", "unknown"
    confidence: float = Field(ge=0.0, le=1.0)
    bbox: BoundingBox


class AccidentType(StrEnum):
    """Accident type classification."""

    REAR_END = "rear_end"
    LANE_CHANGE = "lane_change"
    SIGNAL_VIOLATION = "signal_violation"
    INTERSECTION = "intersection"
    HEAD_ON = "head_on"
    SIDE_COLLISION = "side_collision"
    UNKNOWN = "unknown"


class AccidentClassification(BaseModel):
    """Accident type classification result."""

    accident_type: AccidentType = AccidentType.UNKNOWN
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    involved_vehicles: list[int] = Field(default_factory=list)
    collision_timestamp: float = 0.0
    details: str = ""


class VideoMetadata(BaseModel):
    """Video file metadata."""

    duration: float
    width: int
    height: int
    fps: float
    codec: str = ""


class VideoAnalysisResult(BaseModel):
    """Complete video analysis output (Req 2)."""

    job_id: str
    video_duration: float = 0.0
    total_frames: int = 0
    fps_extracted: int = 2
    detections: list[DetectionResult] = Field(default_factory=list)
    vehicle_tracks: list[VehicleTrack] = Field(default_factory=list)
    traffic_lights: list[TrafficLightState] = Field(default_factory=list)
    accident: AccidentClassification = Field(default_factory=AccidentClassification)
    metadata: VideoMetadata | None = None
    ego_vehicle_id: int = 0  # 자차 (블랙박스 장착 차량) - 항상 사고 당사자
