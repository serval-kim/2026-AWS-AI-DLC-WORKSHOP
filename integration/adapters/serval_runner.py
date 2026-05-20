"""Serval AnalysisPipeline runner for integration layer.

Wraps Serval's 3-stage pipeline (VideoAnalyzer → FaultAnalyzer → ScriptGenerator)
without Redis Queue or S3 callback dependencies.
"""

import shutil
import sys
import tempfile
from pathlib import Path

# Path setup for Serval and accident-rag imports
_BASE_DIR = Path(__file__).resolve().parent.parent.parent
_SERVAL_PATH = str(_BASE_DIR / "ad-hoc" / "serval")
_ACCIDENT_RAG_PATH = str(_BASE_DIR / "ad-hoc" / "andy" / "accident-rag" / "src")

if _SERVAL_PATH not in sys.path:
    sys.path.insert(0, _SERVAL_PATH)
if _ACCIDENT_RAG_PATH not in sys.path:
    sys.path.insert(0, _ACCIDENT_RAG_PATH)

from shared.clients import S3Client
from shared.logging import get_logger
from shared.models.analysis import StructuredAnalysis
from shared.models.job import StageError
from worker.fault_analyzer import FaultAnalyzer
from worker.script_generator import ScriptGenerator
from worker.video_analyzer import VideoAnalyzer

logger = get_logger(__name__)


class ServalAnalysisResult:
    """Result container for Serval pipeline execution."""

    __slots__ = ("structured_analysis", "errors", "partial_results")

    def __init__(self) -> None:
        self.structured_analysis: StructuredAnalysis | None = None
        self.errors: list[StageError] = []
        self.partial_results: dict = {}

    @property
    def success(self) -> bool:
        """True if full pipeline completed successfully."""
        return self.structured_analysis is not None

    @property
    def status(self) -> str:
        """Pipeline result status."""
        if self.structured_analysis:
            return "completed"
        if self.partial_results:
            return "partial"
        return "failed"


class ServalAnalysisRunner:
    """Integration-scoped Serval pipeline runner.

    Runs the 3-stage analysis pipeline (VideoAnalyzer → FaultAnalyzer →
    ScriptGenerator) directly via Python imports, bypassing Redis Queue
    and S3 callback mechanisms used in the standalone Serval deployment.
    """

    def __init__(self) -> None:
        self._s3 = S3Client()
        self._video_analyzer = VideoAnalyzer()
        self._fault_analyzer = FaultAnalyzer()
        self._script_generator = ScriptGenerator()

    def run(self, video_s3_key: str, job_id: str) -> ServalAnalysisResult:
        """Execute Serval's 3-stage pipeline and return results.

        Args:
            video_s3_key: S3 key of the input video file.
            job_id: Unique job identifier for correlation logging.

        Returns:
            ServalAnalysisResult with structured_analysis (if successful),
            errors, and partial_results.
        """
        logger.info("serval_runner_start", job_id=job_id, video_s3_key=video_s3_key)
        result = ServalAnalysisResult()
        tmp_dir = tempfile.mkdtemp(prefix=f"integration_{job_id}_")

        try:
            # Stage 1: Video Analysis
            video_analysis = self._run_video_analysis(video_s3_key, job_id, tmp_dir, result)
            if video_analysis is None:
                return result

            result.partial_results["video_analysis"] = video_analysis.model_dump(mode="json")

            # Stage 2: Fault Analysis
            fault_result = self._run_fault_analysis(video_analysis, job_id, result)
            if fault_result is None:
                return result

            result.partial_results["fault_result"] = fault_result.model_dump(mode="json")

            # Check undetermined
            if fault_result.undetermined:
                logger.warning(
                    "fault_undetermined",
                    job_id=job_id,
                    reason=fault_result.undetermined_reason,
                )
                result.errors.append(StageError(
                    stage="fault_analysis",
                    error_type="UNDETERMINED",
                    message=fault_result.undetermined_reason or "과실비율 판정 불가",
                    recoverable=True,
                ))
                return result

            # Stage 3: Script Generation
            structured = self._run_script_generation(fault_result, video_analysis, job_id, result)
            if structured is not None:
                result.structured_analysis = structured

            return result

        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            logger.info("serval_runner_cleanup", job_id=job_id, tmp_dir=tmp_dir)

    def _run_video_analysis(self, video_s3_key, job_id, tmp_dir, result):
        """Stage 1: Download video from S3 and run VideoAnalyzer."""
        try:
            local_video = self._s3.download_file(
                video_s3_key, f"{tmp_dir}/input.mp4"
            )
            video_analysis = self._video_analyzer.analyze(local_video, job_id)
            logger.info("serval_stage_complete", stage="video_analysis", job_id=job_id)
            return video_analysis
        except Exception as e:
            error_type = self._classify_error(e)
            recoverable = error_type not in ("NO_VEHICLE", "CORRUPTED_VIDEO")
            result.errors.append(StageError(
                stage="video_analysis",
                error_type=error_type,
                message=str(e),
                recoverable=recoverable,
            ))
            logger.error("serval_stage_failed", stage="video_analysis", job_id=job_id, error=str(e))
            return None

    def _run_fault_analysis(self, video_analysis, job_id, result):
        """Stage 2: Run FaultAnalyzer with RAG + LLM."""
        try:
            fault_result = self._fault_analyzer.run(video_analysis)
            logger.info("serval_stage_complete", stage="fault_analysis", job_id=job_id)
            return fault_result
        except Exception as e:
            result.errors.append(StageError(
                stage="fault_analysis",
                error_type="LLM_FAILURE",
                message=str(e),
                recoverable=True,
            ))
            logger.error("serval_stage_failed", stage="fault_analysis", job_id=job_id, error=str(e))
            return None

    def _run_script_generation(self, fault_result, video_analysis, job_id, result):
        """Stage 3: Run ScriptGenerator to produce StructuredAnalysis."""
        try:
            structured = self._script_generator.run(fault_result, video_analysis)
            logger.info("serval_stage_complete", stage="script_generation", job_id=job_id)
            return structured
        except Exception as e:
            result.errors.append(StageError(
                stage="script_generation",
                error_type="GENERATION_FAILURE",
                message=str(e),
                recoverable=True,
            ))
            logger.error("serval_stage_failed", stage="script_generation", job_id=job_id, error=str(e))
            return None

    @staticmethod
    def _classify_error(error: Exception) -> str:
        """Classify error type from exception message."""
        msg = str(error)
        if "NO_VEHICLE" in msg:
            return "NO_VEHICLE"
        if "CORRUPTED_VIDEO" in msg:
            return "CORRUPTED_VIDEO"
        if "resolution" in msg.lower():
            return "LOW_RESOLUTION"
        return "UNKNOWN_ERROR"
