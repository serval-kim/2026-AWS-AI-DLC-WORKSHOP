"""Integration API Server — FastAPI.

Provides HTTP endpoints for the E2E pipeline:
  POST /analyze — Start analysis (accepts video_s3_key)
  GET /jobs/{job_id} — Poll job status
  GET /files/{job_id}/{filename} — Serve generated files
"""

import os
import json
from pathlib import Path

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import structlog
import uvicorn

logger = structlog.get_logger(__name__)

app = FastAPI(title="한문철 릴스 생성 API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store
jobs: dict[str, dict] = {}

BASE_DIR = Path(__file__).parent.parent


# --- Request/Response Models (SECURITY-05: Input Validation) ---


class AnalyzeRequest(BaseModel):
    """POST /analyze request body."""

    video_s3_key: str = Field(
        min_length=1,
        max_length=500,
        description="S3 key of the input video file",
    )
    mode: str = Field(
        default="parallel",
        pattern=r"^(parallel|sequential)$",
        description="Juan pipeline execution mode",
    )


class JobResponse(BaseModel):
    """Standard job status response."""

    job_id: str
    status: str
    script: dict | None = None
    videoUrl: str | None = None
    audioUrls: dict | None = None
    errors: list[dict] | None = None
    partial_results: dict | None = None


# --- Background Tasks ---


def _run_full_pipeline(job_id: str, video_s3_key: str, mode: str) -> None:
    """Background task: run the full E2E pipeline."""
    log = logger.bind(job_id=job_id)
    log.info("background_pipeline_start", video_s3_key=video_s3_key, mode=mode)

    try:
        from api import run_pipeline
        result = run_pipeline(video_s3_key=video_s3_key)

        jobs[job_id]["status"] = result["status"]

        if result["status"] == "completed":
            jobs[job_id]["script"] = result.get("script")
            jobs[job_id]["videoPath"] = result.get("videoPath")
            jobs[job_id]["outputDir"] = result.get("outputDir")
            jobs[job_id]["audioPaths"] = result.get("audioPaths", [])
        elif result["status"] == "partial":
            jobs[job_id]["partial_results"] = result.get("partial_results")
            jobs[job_id]["errors"] = result.get("errors", [])
        else:
            jobs[job_id]["errors"] = result.get("errors", [])

        log.info("background_pipeline_complete", status=result["status"])

    except Exception as e:
        # SECURITY-09: No stack trace in response
        log.error("background_pipeline_exception", error=str(e))
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["errors"] = [
            {"stage": "pipeline", "error_type": "UNEXPECTED", "message": "Internal processing error"}
        ]


# --- Endpoints ---


@app.post("/analyze", response_model=JobResponse)
async def analyze(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """Start analysis pipeline.

    Accepts video_s3_key and dispatches background processing.
    Returns immediately with job_id for status polling.
    """
    import uuid
    job_id = str(uuid.uuid4())[:8]
    log = logger.bind(job_id=job_id)
    log.info("analyze_request", video_s3_key=request.video_s3_key, mode=request.mode)

    jobs[job_id] = {"status": "processing"}
    background_tasks.add_task(_run_full_pipeline, job_id, request.video_s3_key, request.mode)

    return JobResponse(job_id=job_id, status="processing")


@app.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    """Poll job status."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]
    response = JobResponse(job_id=job_id, status=job["status"])

    if job["status"] == "completed":
        response.script = job.get("script")
        response.videoUrl = f"/files/{job_id}/hanmuncheol_reels.mp4"
        response.audioUrls = {
            "intro": f"/files/{job_id}/intro_tts.mp3",
            "analysis": f"/files/{job_id}/analysis_tts.mp3",
            "conclusion": f"/files/{job_id}/conclusion_tts.mp3",
        }
    elif job["status"] in ("partial", "failed"):
        response.errors = job.get("errors")
        response.partial_results = job.get("partial_results")

    return response


@app.get("/files/{job_id}/{filename}")
async def serve_file(job_id: str, filename: str):
    """Serve generated output files."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]
    output_dir = job.get("outputDir")
    if not output_dir:
        raise HTTPException(status_code=404, detail="No output available")

    path = Path(output_dir) / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # SECURITY-09: Prevent path traversal
    try:
        path.resolve().relative_to(Path(output_dir).resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")

    media_type = "video/mp4" if filename.endswith(".mp4") else "audio/mpeg"
    return FileResponse(path, media_type=media_type)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "version": "0.2.0"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
