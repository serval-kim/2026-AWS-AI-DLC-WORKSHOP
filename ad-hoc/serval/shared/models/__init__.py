"""Domain models for accident analysis system."""

from shared.models.job import AnalysisJob, JobStatus, ResultKeys, StageError
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
from shared.models.fault import FaultRatio, FaultResult, LegalReference
from shared.models.analysis import (
    AnalysisSection,
    ConclusionSection,
    DriverAction,
    IntroSection,
    StructuredAnalysis,
    TimestampRange,
)

__all__ = [
    "AnalysisJob",
    "JobStatus",
    "ResultKeys",
    "StageError",
    "AccidentClassification",
    "AccidentType",
    "BoundingBox",
    "DetectionResult",
    "FrameData",
    "TrackPoint",
    "TrafficLightState",
    "VehicleTrack",
    "VideoAnalysisResult",
    "VideoMetadata",
    "FaultRatio",
    "FaultResult",
    "LegalReference",
    "AnalysisSection",
    "ConclusionSection",
    "DriverAction",
    "IntroSection",
    "StructuredAnalysis",
    "TimestampRange",
]
