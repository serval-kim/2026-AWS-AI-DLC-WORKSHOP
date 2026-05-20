"""Job lifecycle models."""

from datetime import datetime, timezone
from enum import StrEnum

from pydantic import BaseModel, Field


class JobStatus(StrEnum):
    """Analysis job status."""

    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class StageError(BaseModel):
    """Error information for a pipeline stage."""

    stage: str
    error_type: str
    message: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    recoverable: bool = True


class ResultKeys(BaseModel):
    """S3 keys for pipeline stage results."""

    video_analysis: str | None = None
    fault_result: str | None = None
    structured_analysis: str | None = None


class AnalysisJob(BaseModel):
    """Analysis job tracking model."""

    job_id: str
    video_s3_key: str
    status: JobStatus = JobStatus.PENDING
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    callback_url: str = ""
    current_stage: str = ""
    errors: list[StageError] = Field(default_factory=list)
    result_keys: ResultKeys = Field(default_factory=ResultKeys)
