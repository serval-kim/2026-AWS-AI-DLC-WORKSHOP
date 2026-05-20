"""API route definitions."""

import uuid

import redis
from fastapi import APIRouter, HTTPException
from rq import Queue

from shared.clients import S3Client
from shared.config import settings
from shared.logging import get_logger
from shared.models.job import AnalysisJob, JobStatus
from api.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    CallbackRequest,
    ErrorResponse,
    HealthResponse,
    StatusResponse,
)

logger = get_logger(__name__)
router = APIRouter()

# Lazy-initialized dependencies
_redis_conn: redis.Redis | None = None
_queue: Queue | None = None
_s3: S3Client | None = None


def _get_redis() -> redis.Redis:
    global _redis_conn
    if _redis_conn is None:
        _redis_conn = redis.Redis(host=settings.redis_host, port=settings.redis_port)
    return _redis_conn


def _get_queue() -> Queue:
    global _queue
    if _queue is None:
        _queue = Queue(settings.redis_queue_name, connection=_get_redis())
    return _queue


def _get_s3() -> S3Client:
    global _s3
    if _s3 is None:
        _s3 = S3Client()
    return _s3


@router.post("/analyze", response_model=AnalyzeResponse)
def create_analysis(request: AnalyzeRequest) -> AnalyzeResponse:
    """Create a new analysis job."""
    job_id = str(uuid.uuid4())
    logger.info("analysis_request", job_id=job_id, video_s3_key=request.video_s3_key)

    # Verify video exists in S3
    s3 = _get_s3()
    if not s3.file_exists(request.video_s3_key):
        raise HTTPException(status_code=404, detail=f"Video not found: {request.video_s3_key}")

    # Create initial job status
    job = AnalysisJob(
        job_id=job_id,
        video_s3_key=request.video_s3_key,
        status=JobStatus.PENDING,
        callback_url=settings.api_callback_url,
    )
    s3.set_job_status(job)

    # Enqueue job for worker
    queue = _get_queue()
    queue.enqueue(
        "worker.pipeline.AnalysisPipeline.run",
        args=(AnalysisPipeline_placeholder := None,),  # RQ will instantiate
        kwargs={"job_id": job_id, "video_s3_key": request.video_s3_key},
        job_id=job_id,
        job_timeout=600,  # 10 minutes max
    )

    # Actually enqueue using the function path
    queue.enqueue(
        "worker.tasks.run_analysis",
        job_id=job_id,
        video_s3_key=request.video_s3_key,
        callback_url=settings.api_callback_url,
        job_timeout=600,
    )

    logger.info("analysis_enqueued", job_id=job_id)
    return AnalyzeResponse(job_id=job_id, status=JobStatus.PENDING)


@router.get("/status/{job_id}", response_model=StatusResponse)
def get_status(job_id: str) -> StatusResponse:
    """Get analysis job status."""
    s3 = _get_s3()
    job = s3.get_job_status(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")

    return StatusResponse(
        job_id=job.job_id,
        status=job.status,
        current_stage=job.current_stage,
        errors=job.errors,
        result_keys=job.result_keys,
    )


@router.get("/result/{job_id}")
def get_result(job_id: str) -> dict:
    """Get analysis result."""
    s3 = _get_s3()
    job = s3.get_job_status(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")

    if job.status not in (JobStatus.COMPLETED, JobStatus.PARTIAL):
        raise HTTPException(
            status_code=400,
            detail=f"Job not ready. Current status: {job.status}",
        )

    # Return the best available result
    if job.result_keys.structured_analysis:
        return s3.download_json(job.result_keys.structured_analysis)
    elif job.result_keys.fault_result:
        return s3.download_json(job.result_keys.fault_result)
    elif job.result_keys.video_analysis:
        return s3.download_json(job.result_keys.video_analysis)
    else:
        raise HTTPException(status_code=404, detail="No results available")


@router.post("/callback")
def handle_callback(request: CallbackRequest) -> dict:
    """Handle worker completion callback."""
    logger.info("callback_received", job_id=request.job_id, status=request.status)
    return {"received": True, "job_id": request.job_id}


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse()
