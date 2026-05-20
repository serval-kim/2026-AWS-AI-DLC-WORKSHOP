"""Unit tests for shared domain models."""

import pytest
from datetime import datetime, timezone

from shared.models.job import AnalysisJob, JobStatus, StageError, ResultKeys
from shared.models.video import (
    AccidentClassification,
    AccidentType,
    BoundingBox,
    DetectionResult,
    FrameData,
    TrackPoint,
    VehicleTrack,
    VideoAnalysisResult,
    VideoMetadata,
)
from shared.models.fault import FaultRatio, FaultResult, LegalReference
from shared.models.analysis import (
    AnalysisSection,
    ConclusionSection,
    DriverAction,
    IntroSection,
    StructuredAnalysis,
    TimestampRange,
)


class TestJobModels:
    def test_analysis_job_creation(self):
        job = AnalysisJob(job_id="test-123", video_s3_key="videos/test.mp4")
        assert job.status == JobStatus.PENDING
        assert job.job_id == "test-123"
        assert job.errors == []

    def test_job_status_transitions(self):
        job = AnalysisJob(job_id="test-123", video_s3_key="videos/test.mp4")
        job.status = JobStatus.PROCESSING
        assert job.status == JobStatus.PROCESSING

    def test_stage_error(self):
        error = StageError(
            stage="video_analysis",
            error_type="NO_VEHICLE",
            message="No vehicles detected",
            recoverable=True,
        )
        assert error.recoverable is True

    def test_job_serialization_roundtrip(self):
        job = AnalysisJob(
            job_id="test-456",
            video_s3_key="videos/test.mp4",
            status=JobStatus.COMPLETED,
            result_keys=ResultKeys(video_analysis="results/test-456/video_analysis.json"),
        )
        data = job.model_dump(mode="json")
        restored = AnalysisJob.model_validate(data)
        assert restored.job_id == job.job_id
        assert restored.status == job.status
        assert restored.result_keys.video_analysis == job.result_keys.video_analysis


class TestVideoModels:
    def test_bounding_box_valid(self):
        bbox = BoundingBox(x1=0.1, y1=0.2, x2=0.5, y2=0.8, confidence=0.95, class_name="car", class_id=0)
        assert bbox.confidence == 0.95

    def test_bounding_box_confidence_bounds(self):
        with pytest.raises(Exception):
            BoundingBox(x1=0.0, y1=0.0, x2=1.0, y2=1.0, confidence=1.5, class_name="car", class_id=0)

    def test_vehicle_track(self):
        track = VehicleTrack(vehicle_id=1, first_seen=0.0, last_seen=5.0)
        assert track.track_points == []

    def test_accident_classification_default(self):
        acc = AccidentClassification()
        assert acc.accident_type == AccidentType.UNKNOWN
        assert acc.confidence == 0.0

    def test_video_analysis_result_ego_vehicle(self):
        result = VideoAnalysisResult(job_id="test-789")
        assert result.ego_vehicle_id == 0

    def test_video_analysis_serialization(self):
        result = VideoAnalysisResult(
            job_id="test-789",
            video_duration=30.0,
            total_frames=60,
            metadata=VideoMetadata(duration=30.0, width=1280, height=720, fps=30.0),
        )
        data = result.model_dump(mode="json")
        restored = VideoAnalysisResult.model_validate(data)
        assert restored.job_id == result.job_id
        assert restored.metadata.width == 1280


class TestFaultModels:
    def test_fault_ratio_bounds(self):
        ratio = FaultRatio(vehicle_id=0, ratio_percent=70)
        assert ratio.ratio_percent == 70

    def test_fault_ratio_invalid(self):
        with pytest.raises(Exception):
            FaultRatio(vehicle_id=0, ratio_percent=150)

    def test_fault_result_disclaimer(self):
        result = FaultResult(job_id="test-123")
        assert "법적 효력" in result.disclaimer

    def test_fault_result_serialization(self):
        result = FaultResult(
            job_id="test-123",
            ratios=[
                FaultRatio(vehicle_id=0, ratio_percent=30, key_faults=["과속"]),
                FaultRatio(vehicle_id=1, ratio_percent=70, key_faults=["신호위반"]),
            ],
            reasoning="Test reasoning",
            confidence=0.85,
        )
        data = result.model_dump(mode="json")
        restored = FaultResult.model_validate(data)
        assert len(restored.ratios) == 2
        assert sum(r.ratio_percent for r in restored.ratios) == 100


class TestAnalysisModels:
    def test_structured_analysis_creation(self):
        analysis = StructuredAnalysis(
            job_id="test-123",
            intro=IntroSection(
                summary="추돌 사고 발생",
                accident_type="rear_end",
                timestamp=TimestampRange(start=10.0, end=15.0),
            ),
            analysis=AnalysisSection(
                driver_actions=[
                    DriverAction(
                        vehicle_id=0,
                        action="급정거",
                        fault_point="안전거리 미확보",
                        timestamp=TimestampRange(start=10.0, end=12.0),
                    )
                ],
                timestamp=TimestampRange(start=5.0, end=20.0),
            ),
            conclusion=ConclusionSection(
                fault_ratios=[{"vehicle_id": 0, "ratio_percent": 30}],
                legal_basis=["도로교통법 제19조"],
                timestamp=TimestampRange(start=0.0, end=30.0),
            ),
        )
        assert analysis.intro.accident_type == "rear_end"
        assert len(analysis.analysis.driver_actions) == 1

    def test_timestamp_range_valid(self):
        ts = TimestampRange(start=0.0, end=10.0)
        assert ts.start < ts.end
