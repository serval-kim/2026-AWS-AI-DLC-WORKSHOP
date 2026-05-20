"""Integration API — E2E 파이프라인 오케스트레이션.

Connects Serval (video analysis) → Ssol (script refinement) → Juan (video generation).
"""

import json
import os
import uuid
from pathlib import Path

import structlog

from adapters.serval_runner import ServalAnalysisRunner, ServalAnalysisResult
from adapters.serval_to_ssol import structured_analysis_to_pipeline_input

logger = structlog.get_logger(__name__)

# Feature flags
MOCK_SERVAL = os.environ.get("MOCK_SERVAL", "false").lower() == "true"
MOCK_VIDEO_GEN = os.environ.get("MOCK_VIDEO_GEN", "true").lower() == "true"

# Path configuration
BASE_DIR = Path(__file__).resolve().parent.parent
JUAN_MODULE = BASE_DIR / "ad-hoc" / "juan" / "hanmuncheol-reels"
SSOL_MOCK_OUTPUT = BASE_DIR / "ad-hoc" / "ssol" / "mock-output" / "muncheol-script-oneshot.json"
OUTPUT_DIR = Path("/tmp/integration_output")


def run_pipeline(video_s3_key: str | None = None) -> dict:
    """Execute the full E2E pipeline.

    Flow:
        1. Serval: video analysis → StructuredAnalysis
        2. Adapter: StructuredAnalysis → pipeline_input dict
        3. Ssol: pipeline_input → muncheol-script.json (currently mock)
        4. Juan: script → TTS + video generation

    Args:
        video_s3_key: S3 key of the uploaded video. Required when MOCK_SERVAL=false.

    Returns:
        Dict with job_id, status, script, videoPath, audioPaths, outputDir.
        Status is "completed", "partial", or "failed".
    """
    job_id = str(uuid.uuid4())[:8]
    job_dir = OUTPUT_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    log = logger.bind(job_id=job_id)
    log.info("pipeline_start", mock_serval=MOCK_SERVAL, mock_video_gen=MOCK_VIDEO_GEN)

    # Step 1: Get StructuredAnalysis (real or mock)
    serval_result = _run_serval_stage(video_s3_key, job_id, log)

    if serval_result.status == "failed":
        log.warning("pipeline_serval_failed", errors=len(serval_result.errors))
        return {
            "job_id": job_id,
            "status": "failed",
            "errors": [
                {"stage": e.stage, "error_type": e.error_type, "message": e.message}
                for e in serval_result.errors
            ],
        }

    if serval_result.status == "partial":
        log.warning("pipeline_serval_partial", errors=len(serval_result.errors))
        return {
            "job_id": job_id,
            "status": "partial",
            "partial_results": serval_result.partial_results,
            "errors": [
                {"stage": e.stage, "error_type": e.error_type, "message": e.message}
                for e in serval_result.errors
            ],
        }

    # Step 2: Convert StructuredAnalysis → Ssol input
    pipeline_input = structured_analysis_to_pipeline_input(serval_result.structured_analysis)
    log.info("adapter_conversion_complete")

    # Step 3: Generate script (currently using mock Ssol output)
    script = _load_mock_script()
    log.info("ssol_script_loaded", source="mock")

    # Step 4: Save script
    script_path = job_dir / "script.json"
    with open(script_path, "w") as f:
        json.dump(script, f, ensure_ascii=False, indent=2)

    # Step 5: Run Juan pipeline (TTS + video generation)
    output_path = _run_juan_stage(str(script_path), str(job_dir / "output"), log)

    # Step 6: Collect results
    output_dir = job_dir / "output"
    video_file = output_dir / "hanmuncheol_reels.mp4"
    audio_files = sorted(output_dir.glob("*_tts.mp3"))

    log.info("pipeline_complete", status="completed")
    return {
        "job_id": job_id,
        "status": "completed",
        "script": script,
        "videoPath": str(video_file) if video_file.exists() else None,
        "audioPaths": [str(f) for f in audio_files],
        "outputDir": str(output_dir),
    }


def _run_serval_stage(
    video_s3_key: str | None, job_id: str, log
) -> ServalAnalysisResult:
    """Run Serval analysis stage (real or mock).

    Returns:
        ServalAnalysisResult — check .status for outcome.
    """
    if MOCK_SERVAL:
        log.info("serval_mock_mode")
        # Return a mock result that mimics a successful pipeline
        result = ServalAnalysisResult()
        # In mock mode, we skip Serval entirely and use Ssol's mock output directly
        # Signal this by setting a sentinel structured_analysis
        result.structured_analysis = _create_mock_structured_analysis()
        return result

    if not video_s3_key:
        log.error("serval_no_video_key")
        result = ServalAnalysisResult()
        from shared.models.job import StageError
        result.errors.append(StageError(
            stage="input_validation",
            error_type="MISSING_INPUT",
            message="video_s3_key is required when MOCK_SERVAL=false",
            recoverable=False,
        ))
        return result

    runner = ServalAnalysisRunner()
    return runner.run(video_s3_key, job_id)


def _create_mock_structured_analysis():
    """Create a minimal mock StructuredAnalysis for MOCK_SERVAL mode."""
    import sys
    _serval_path = str(BASE_DIR / "ad-hoc" / "serval")
    if _serval_path not in sys.path:
        sys.path.insert(0, _serval_path)

    from shared.models.analysis import (
        AnalysisSection,
        ConclusionSection,
        DriverAction,
        IntroSection,
        StructuredAnalysis,
        TimestampRange,
    )

    return StructuredAnalysis(
        job_id="mock",
        intro=IntroSection(
            summary="Mock 사고 분석",
            accident_type="추돌",
            timestamp=TimestampRange(start=0.0, end=6.0),
            involved_vehicles=2,
        ),
        analysis=AnalysisSection(
            driver_actions=[
                DriverAction(
                    vehicle_id=0,
                    action="급정거",
                    fault_point="전방주시 태만",
                    violated_law="도로교통법 제49조",
                    timestamp=TimestampRange(start=2.0, end=3.0),
                ),
                DriverAction(
                    vehicle_id=1,
                    action="안전거리 미확보",
                    fault_point="안전거리 미확보",
                    violated_law="도로교통법 제19조",
                    timestamp=TimestampRange(start=1.0, end=4.0),
                ),
            ],
            timestamp=TimestampRange(start=0.0, end=4.5),
        ),
        conclusion=ConclusionSection(
            fault_ratios=[
                {"vehicle_id": 0, "ratio_percent": 30},
                {"vehicle_id": 1, "ratio_percent": 70},
            ],
            legal_basis=["도로교통법 제19조", "도로교통법 제49조"],
            timestamp=TimestampRange(start=4.5, end=6.0),
        ),
    )


def _run_juan_stage(script_path: str, output_dir: str, log) -> str | None:
    """Run Juan's video generation pipeline."""
    import sys
    sys.path.insert(0, str(JUAN_MODULE))
    os.environ["MOCK_VIDEO_GEN"] = "true" if MOCK_VIDEO_GEN else "false"

    try:
        from pipeline import run_pipeline as juan_pipeline
        result = juan_pipeline(script_path, output_dir)
        log.info("juan_pipeline_complete", output=result)
        return result
    except Exception as e:
        log.error("juan_pipeline_failed", error=str(e))
        return None


def _load_mock_script() -> dict:
    """Load Ssol's mock script output."""
    with open(SSOL_MOCK_OUTPUT) as f:
        return json.load(f)


if __name__ == "__main__":
    print("Running integration pipeline...")
    print(f"  MOCK_SERVAL={MOCK_SERVAL}")
    print(f"  MOCK_VIDEO_GEN={MOCK_VIDEO_GEN}")
    result = run_pipeline(video_s3_key=None if MOCK_SERVAL else "test/sample.mp4")
    print(f"\nResult:")
    print(f"  job_id: {result['job_id']}")
    print(f"  status: {result['status']}")
    if result["status"] == "completed":
        print(f"  video: {result.get('videoPath')}")
        print(f"  audio: {result.get('audioPaths')}")
    elif result["status"] == "failed":
        print(f"  errors: {result.get('errors')}")
