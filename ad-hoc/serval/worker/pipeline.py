"""Analysis pipeline orchestrator - manages the full analysis workflow."""

import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import httpx

from shared.clients import S3Client
from shared.config import settings
from shared.logging import get_logger
from shared.models.job import AnalysisJob, JobStatus, ResultKeys, StageError
from worker.fault_analyzer import FaultAnalyzer
from worker.script_generator import ScriptGenerator
from worker.video_analyzer import VideoAnalyzer

logger = get_logger(__name__)


class AnalysisPipeline:
    """Orchestrates the full video analysis pipeline with Partial Result strategy."""

    def __init__(self) -> None:
        self._s3 = S3Client()
        self._video_analyzer = VideoAnalyzer()
        self._fault_analyzer = FaultAnalyzer()
        self._script_generator = ScriptGenerator()

    def run(self, job_id: str, video_s3_key: str, callback_url: str | None = None) -> None:
        """Execute the full analysis pipeline."""
        logger.info("pipeline_start", job_id=job_id, video_s3_key=video_s3_key)

        callback_url = callback_url or settings.api_callback_url
        job = AnalysisJob(job_id=job_id, video_s3_key=video_s3_key, callback_url=callback_url)
        job.status = JobStatus.PROCESSING
        self._update_status(job)

        tmp_dir = tempfile.mkdtemp(prefix=f"analysis_{job_id}_")
        result_keys = ResultKeys()
        errors: list[StageError] = []

        try:
            # Stage 1: Video Analysis
            job.current_stage = "video_analysis"
            self._update_status(job)

            video_analysis = None
            try:
                local_video = self._s3.download_file(video_s3_key, f"{tmp_dir}/input.mp4")
                video_analysis = self._video_analyzer.analyze(local_video, job_id)

                # Save video analysis result
                result_key = f"results/{job_id}/video_analysis.json"
                self._s3.upload_json(video_analysis.model_dump(mode="json"), result_key)
                result_keys.video_analysis = result_key
                logger.info("stage_complete", stage="video_analysis", job_id=job_id)

            except Exception as e:
                error = StageError(
                    stage="video_analysis",
                    error_type=self._classify_error(e),
                    message=str(e),
                    recoverable="NO_VEHICLE" not in str(e) and "CORRUPTED_VIDEO" not in str(e),
                )
                errors.append(error)
                logger.error("stage_failed", stage="video_analysis", error=str(e))

                if not error.recoverable:
                    self._finalize(job, JobStatus.FAILED, result_keys, errors, callback_url)
                    return

            # Stage 2: Fault Analysis
            if video_analysis:
                job.current_stage = "fault_analysis"
                self._update_status(job)

                fault_result = None
                try:
                    fault_result = self._fault_analyzer.run(video_analysis)

                    result_key = f"results/{job_id}/fault_result.json"
                    self._s3.upload_json(fault_result.model_dump(mode="json"), result_key)
                    result_keys.fault_result = result_key
                    logger.info("stage_complete", stage="fault_analysis", job_id=job_id)

                except Exception as e:
                    errors.append(StageError(
                        stage="fault_analysis",
                        error_type="LLM_FAILURE",
                        message=str(e),
                        recoverable=True,
                    ))
                    logger.error("stage_failed", stage="fault_analysis", error=str(e))

                # Stage 3: Script Generation
                if fault_result and not fault_result.undetermined:
                    job.current_stage = "script_generation"
                    self._update_status(job)

                    try:
                        structured = self._script_generator.run(fault_result, video_analysis)

                        result_key = f"results/{job_id}/structured_analysis.json"
                        self._s3.upload_json(structured.model_dump(mode="json"), result_key)
                        result_keys.structured_analysis = result_key
                        logger.info("stage_complete", stage="script_generation", job_id=job_id)

                    except Exception as e:
                        errors.append(StageError(
                            stage="script_generation",
                            error_type="GENERATION_FAILURE",
                            message=str(e),
                            recoverable=True,
                        ))
                        logger.error("stage_failed", stage="script_generation", error=str(e))

            # Determine final status
            if not errors:
                final_status = JobStatus.COMPLETED
            elif any(rk for rk in [result_keys.video_analysis, result_keys.fault_result, result_keys.structured_analysis]):
                final_status = JobStatus.PARTIAL
            else:
                final_status = JobStatus.FAILED

            self._finalize(job, final_status, result_keys, errors, callback_url)

        finally:
            # Cleanup temp files
            shutil.rmtree(tmp_dir, ignore_errors=True)
            logger.info("pipeline_cleanup", job_id=job_id, tmp_dir=tmp_dir)

    def _update_status(self, job: AnalysisJob) -> None:
        """Update job status in S3."""
        job.updated_at = datetime.now(timezone.utc)
        self._s3.set_job_status(job)

    def _finalize(
        self,
        job: AnalysisJob,
        status: JobStatus,
        result_keys: ResultKeys,
        errors: list[StageError],
        callback_url: str,
    ) -> None:
        """Finalize pipeline execution - update status and send callback."""
        job.status = status
        job.result_keys = result_keys
        job.errors = errors
        job.current_stage = "completed"
        self._update_status(job)

        logger.info("pipeline_complete", job_id=job.job_id, status=status, error_count=len(errors))

        # Send callback
        self._send_callback(job, callback_url)

    def _send_callback(self, job: AnalysisJob, callback_url: str) -> None:
        """Send completion callback to api-server with retries."""
        payload = {
            "job_id": job.job_id,
            "status": job.status,
            "result_keys": job.result_keys.model_dump(),
            "errors": [e.model_dump(mode="json") for e in job.errors],
        }

        for attempt in range(settings.callback_max_retries):
            try:
                response = httpx.post(callback_url, json=payload, timeout=10.0)
                if response.status_code < 400:
                    logger.info("callback_sent", job_id=job.job_id, attempt=attempt + 1)
                    return
            except Exception as e:
                logger.warning("callback_failed", job_id=job.job_id, attempt=attempt + 1, error=str(e))

        logger.error("callback_exhausted", job_id=job.job_id, max_retries=settings.callback_max_retries)

    def _classify_error(self, error: Exception) -> str:
        """Classify error type from exception."""
        msg = str(error)
        if "NO_VEHICLE" in msg:
            return "NO_VEHICLE"
        if "CORRUPTED_VIDEO" in msg:
            return "CORRUPTED_VIDEO"
        if "resolution" in msg.lower():
            return "LOW_RESOLUTION"
        return "UNKNOWN_ERROR"
