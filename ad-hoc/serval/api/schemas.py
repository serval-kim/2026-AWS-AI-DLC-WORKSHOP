"""API request/response schemas."""

from pydantic import BaseModel, Field

from shared.models.job import JobStatus, ResultKeys, StageError


class AnalyzeRequest(BaseModel):
    """POST /analyze request body."""

    video_s3_key: str = Field(min_length=1, max_length=500, description="S3 key of the video file")


class AnalyzeResponse(BaseModel):
    """POST /analyze response body."""

    job_id: str
    status: JobStatus
    message: str = "Analysis job created"


class StatusResponse(BaseModel):
    """GET /status/{job_id} response body."""

    job_id: str
    status: JobStatus
    current_stage: str = ""
    errors: list[StageError] = Field(default_factory=list)
    result_keys: ResultKeys = Field(default_factory=ResultKeys)


class CallbackRequest(BaseModel):
    """POST /callback request body (from worker)."""

    job_id: str
    status: str
    result_keys: dict = Field(default_factory=dict)
    errors: list[dict] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    """Generic error response."""

    error: str
    detail: str = ""


class HealthResponse(BaseModel):
    """GET /health response."""

    status: str = "healthy"
    version: str = "0.1.0"
