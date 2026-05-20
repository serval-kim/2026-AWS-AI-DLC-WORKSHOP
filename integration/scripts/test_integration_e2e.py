"""End-to-end integration test: Serval → Adapter → Ssol(mock) → Juan(mock).

Extension of ad-hoc/serval/scripts/test_analysis_e2e.py — this script
validates the full integration pipeline including the adapter conversion
and downstream module calls.

Usage:
    # Run with a specific video (real Serval + mock Juan)
    python scripts/test_integration_e2e.py --video accident-videos/sample1.mp4

    # Use first available video in S3
    python scripts/test_integration_e2e.py --first

    # Full mock mode (no AWS calls — uses mock StructuredAnalysis)
    python scripts/test_integration_e2e.py --mock-serval

    # List available videos
    python scripts/test_integration_e2e.py --list

Environment:
    MOCK_SERVAL=true/false   Skip Serval (use mock StructuredAnalysis)
    MOCK_VIDEO_GEN=true      Skip Juan's Nova Reel (always true for testing)

    AWS credentials loaded from credentials.env at workspace root.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

# Path setup
_SCRIPT_DIR = Path(__file__).resolve().parent
_INTEGRATION_DIR = _SCRIPT_DIR.parent
_BASE_DIR = _INTEGRATION_DIR.parent
_SERVAL_PATH = str(_BASE_DIR / "ad-hoc" / "serval")
_ACCIDENT_RAG_PATH = str(_BASE_DIR / "ad-hoc" / "andy" / "accident-rag" / "src")

sys.path.insert(0, str(_INTEGRATION_DIR))
sys.path.insert(0, _SERVAL_PATH)
sys.path.insert(0, _ACCIDENT_RAG_PATH)

# Load credentials.env if available
_CREDS_FILE = _BASE_DIR / "credentials.env"
if _CREDS_FILE.exists():
    with open(_CREDS_FILE) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())

from shared.config import settings
from shared.logging import setup_logging, get_logger

setup_logging()
logger = get_logger(__name__)

S3_BUCKET = "accident-blackbox"
S3_PREFIX = "accident-videos/"


# =============================================================================
# Helpers
# =============================================================================


def list_videos() -> list[str]:
    """List available videos in S3."""
    import boto3
    s3 = boto3.client(
        "s3",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        aws_session_token=settings.aws_session_token or None,
        region_name=settings.effective_region,
    )
    response = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=S3_PREFIX)

    videos = []
    for obj in response.get("Contents", []):
        key = obj["Key"]
        if key.lower().endswith((".mp4", ".avi", ".mov")):
            videos.append(key)
            print(f"  📹 {key} ({obj['Size'] / 1024 / 1024:.1f} MB)")

    if not videos:
        print("❌ No videos found in s3://accident-blackbox/accident-videos/")
    return videos


# =============================================================================
# Pipeline Stages
# =============================================================================


def run_serval_stage(video_s3_key: str, job_id: str) -> dict:
    """Run Serval stage via ServalAnalysisRunner (same as integration/api.py)."""
    from adapters.serval_runner import ServalAnalysisRunner

    print("\n" + "=" * 60)
    print("🔬 STAGE 1: Serval Analysis (VideoAnalyzer → FaultAnalyzer → ScriptGenerator)")
    print("=" * 60)
    print(f"   Video: s3://{S3_BUCKET}/{video_s3_key}")

    runner = ServalAnalysisRunner()
    start = time.time()
    result = runner.run(video_s3_key, job_id)
    elapsed = time.time() - start

    print(f"\n   ⏱️  Total Serval time: {elapsed:.1f}s")
    print(f"   📊 Status: {result.status}")

    if result.errors:
        for err in result.errors:
            symbol = "❌" if not err.recoverable else "⚠️"
            print(f"   {symbol} [{err.stage}] {err.error_type}: {err.message}")

    if result.structured_analysis:
        sa = result.structured_analysis
        print(f"\n   ✅ StructuredAnalysis generated:")
        print(f"      사고유형: {sa.intro.accident_type}")
        print(f"      운전자행동: {len(sa.analysis.driver_actions)}건")
        print(f"      과실비율: {sa.conclusion.fault_ratios}")

    return {
        "result": result,
        "elapsed": elapsed,
    }


def run_adapter_stage(structured_analysis) -> dict:
    """Run adapter conversion: StructuredAnalysis → pipeline_input dict."""
    from adapters.serval_to_ssol import structured_analysis_to_pipeline_input, pipeline_input_to_script_prompt

    print("\n" + "=" * 60)
    print("🔄 STAGE 2: Adapter Conversion (StructuredAnalysis → Ssol input)")
    print("=" * 60)

    start = time.time()
    pipeline_input = structured_analysis_to_pipeline_input(structured_analysis)
    elapsed = time.time() - start

    print(f"\n   ⏱️  Conversion time: {elapsed * 1000:.1f}ms")
    print(f"   ✅ Pipeline input:")
    print(f"      accident_type: {pipeline_input['accident_type']}")
    print(f"      fault_ratios: {pipeline_input['fault_ratios']}")
    print(f"      legal_basis: {pipeline_input['legal_basis']}")
    print(f"      video_duration: {pipeline_input['video_duration']}s")
    print(f"      collision_timestamp: {pipeline_input['collision_timestamp']}s")
    print(f"      driver_actions: {len(pipeline_input['driver_actions'])}건")

    # Validation checks
    errors = []
    ratio_sum = sum(r.get("ratio_percent", 0) for r in pipeline_input.get("fault_ratios", []))
    if ratio_sum != 100 and ratio_sum != 0:
        errors.append(f"fault_ratios sum = {ratio_sum} (expected 100)")
    if pipeline_input["video_duration"] <= 0:
        errors.append(f"video_duration <= 0: {pipeline_input['video_duration']}")

    if errors:
        print(f"\n   ⚠️  Validation warnings:")
        for e in errors:
            print(f"      - {e}")
    else:
        print(f"\n   ✅ All validations passed (ratio_sum={ratio_sum}%)")

    # Generate prompt preview
    prompt = pipeline_input_to_script_prompt(pipeline_input)
    print(f"\n   📝 Script prompt preview:")
    for line in prompt.strip().split("\n")[:6]:
        print(f"      {line}")

    return {
        "pipeline_input": pipeline_input,
        "prompt": prompt,
        "elapsed": elapsed,
        "errors": errors,
    }


def run_ssol_stage(pipeline_input: dict) -> dict:
    """Run Ssol stage (currently mock — loads muncheol-script.json)."""
    print("\n" + "=" * 60)
    print("📜 STAGE 3: Ssol Script Generation (mock)")
    print("=" * 60)

    mock_path = _BASE_DIR / "ad-hoc" / "ssol" / "mock-output" / "muncheol-script-oneshot.json"

    if not mock_path.exists():
        print(f"   ❌ Mock script not found: {mock_path}")
        return {"script": None, "error": "mock script not found"}

    with open(mock_path) as f:
        script = json.load(f)

    print(f"   ✅ Mock script loaded: {mock_path.name}")
    if "script" in script:
        sections = script["script"]
        for key in ["intro", "analysis", "conclusion"]:
            if key in sections:
                print(f"      {key}: ✅")
    print(f"   📏 Total duration: {script.get('total_duration_sec', '?')}s")

    return {"script": script}


def run_juan_stage(script: dict, output_dir: str) -> dict:
    """Run Juan stage (video generation — mock mode)."""
    print("\n" + "=" * 60)
    print("🎬 STAGE 4: Juan Video Generation (MOCK_VIDEO_GEN=true)")
    print("=" * 60)

    os.environ["MOCK_VIDEO_GEN"] = "true"

    juan_path = _BASE_DIR / "ad-hoc" / "juan" / "hanmuncheol-reels"
    sys.path.insert(0, str(juan_path))

    # Save script for Juan
    script_path = Path(output_dir) / "script.json"
    script_path.parent.mkdir(parents=True, exist_ok=True)
    with open(script_path, "w") as f:
        json.dump(script, f, ensure_ascii=False, indent=2)

    start = time.time()
    try:
        from pipeline import run_pipeline as juan_pipeline
        result = juan_pipeline(str(script_path), str(Path(output_dir) / "output"))
        elapsed = time.time() - start

        output_path = Path(output_dir) / "output"
        video_file = output_path / "hanmuncheol_reels.mp4"
        audio_files = sorted(output_path.glob("*_tts.mp3"))

        print(f"\n   ⏱️  Juan time: {elapsed:.1f}s")
        print(f"   🎥 Video: {'✅' if video_file.exists() else '❌'} {video_file}")
        print(f"   🔊 Audio files: {len(audio_files)}")
        for af in audio_files:
            print(f"      - {af.name} ({af.stat().st_size / 1024:.1f} KB)")

        return {
            "video_path": str(video_file) if video_file.exists() else None,
            "audio_files": [str(f) for f in audio_files],
            "elapsed": elapsed,
        }

    except Exception as e:
        elapsed = time.time() - start
        print(f"\n   ❌ Juan pipeline failed: {e}")
        return {"video_path": None, "audio_files": [], "elapsed": elapsed, "error": str(e)}


# =============================================================================
# Mock Serval
# =============================================================================


def create_mock_structured_analysis():
    """Create mock StructuredAnalysis for --mock-serval mode."""
    from shared.models.analysis import (
        AnalysisSection,
        ConclusionSection,
        DriverAction,
        IntroSection,
        StructuredAnalysis,
        TimestampRange,
    )

    return StructuredAnalysis(
        job_id="e2e-mock",
        intro=IntroSection(
            summary="2차로에서 뒤차가 앞차를 추돌한 사고",
            accident_type="추돌",
            timestamp=TimestampRange(start=0.0, end=6.0),
            involved_vehicles=2,
        ),
        analysis=AnalysisSection(
            driver_actions=[
                DriverAction(
                    vehicle_id=0,
                    action="급정거",
                    fault_point="전방주시 태만으로 인한 급정거",
                    violated_law="도로교통법 제49조",
                    timestamp=TimestampRange(start=2.0, end=3.0),
                ),
                DriverAction(
                    vehicle_id=1,
                    action="안전거리 미확보 상태에서 주행",
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
            legal_basis=["도로교통법 제19조(안전거리 확보)", "도로교통법 제49조(모든 운전자의 의무)"],
            timestamp=TimestampRange(start=4.5, end=6.0),
        ),
    )


# =============================================================================
# Main
# =============================================================================


def main():
    parser = argparse.ArgumentParser(
        description="Integration E2E test: Serval → Adapter → Ssol(mock) → Juan(mock)"
    )
    parser.add_argument("--list", action="store_true", help="List available videos in S3")
    parser.add_argument("--video", type=str, help="S3 key of video to analyze")
    parser.add_argument("--first", action="store_true", help="Use first available video")
    parser.add_argument("--mock-serval", action="store_true", help="Skip real Serval (use mock StructuredAnalysis)")
    parser.add_argument("--skip-juan", action="store_true", help="Skip Juan stage (adapter test only)")
    parser.add_argument("--output", type=str, default="integration/test_output", help="Output directory")
    args = parser.parse_args()

    print("🚀 Integration E2E Test")
    print(f"   Pipeline: Serval → Adapter → Ssol(mock) → Juan(mock)")
    print(f"   MOCK_SERVAL: {args.mock_serval or os.environ.get('MOCK_SERVAL', 'false')}")
    print(f"   MOCK_VIDEO_GEN: true (always for testing)")
    print()

    if args.list:
        print("📋 Available videos:")
        list_videos()
        return

    # Determine mode
    use_mock_serval = args.mock_serval or os.environ.get("MOCK_SERVAL", "false").lower() == "true"

    output_dir = str(_BASE_DIR / args.output)
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    job_id = f"e2e-int-{int(time.time())}"
    results = {"job_id": job_id, "stages": {}}
    overall_start = time.time()

    # === STAGE 1: Serval ===
    if use_mock_serval:
        print("\n" + "=" * 60)
        print("🔬 STAGE 1: Serval Analysis (MOCK MODE)")
        print("=" * 60)
        print("   Using mock StructuredAnalysis (no AWS calls)")
        structured_analysis = create_mock_structured_analysis()
        results["stages"]["serval"] = {"status": "mock", "elapsed": 0}
    else:
        # Determine video
        video_key = args.video
        if args.first or not video_key:
            videos = list_videos()
            if not videos:
                sys.exit(1)
            video_key = videos[0]
            print(f"\n→ Using: {video_key}")

        serval_out = run_serval_stage(video_key, job_id)
        serval_result = serval_out["result"]
        results["stages"]["serval"] = {"status": serval_result.status, "elapsed": serval_out["elapsed"]}

        if not serval_result.success:
            print(f"\n❌ Serval stage failed (status={serval_result.status}). Aborting.")
            _save_summary(results, output_dir, time.time() - overall_start)
            sys.exit(1)

        structured_analysis = serval_result.structured_analysis

    # === STAGE 2: Adapter ===
    adapter_out = run_adapter_stage(structured_analysis)
    results["stages"]["adapter"] = {
        "status": "completed",
        "elapsed": adapter_out["elapsed"],
        "validation_errors": adapter_out["errors"],
    }

    # === STAGE 3: Ssol ===
    ssol_out = run_ssol_stage(adapter_out["pipeline_input"])
    results["stages"]["ssol"] = {"status": "mock", "has_script": ssol_out["script"] is not None}

    if ssol_out["script"] is None:
        print("\n❌ Ssol script not available. Aborting Juan stage.")
        _save_summary(results, output_dir, time.time() - overall_start)
        sys.exit(1)

    # === STAGE 4: Juan ===
    if args.skip_juan:
        print("\n⏭️  Skipping Juan stage (--skip-juan)")
        results["stages"]["juan"] = {"status": "skipped"}
    else:
        juan_out = run_juan_stage(ssol_out["script"], output_dir)
        results["stages"]["juan"] = {
            "status": "completed" if juan_out.get("video_path") else "failed",
            "elapsed": juan_out["elapsed"],
            "video_path": juan_out.get("video_path"),
            "audio_count": len(juan_out.get("audio_files", [])),
        }

    # === SUMMARY ===
    total_elapsed = time.time() - overall_start
    _save_summary(results, output_dir, total_elapsed)
    _print_summary(results, total_elapsed, output_dir)


def _save_summary(results: dict, output_dir: str, elapsed: float):
    """Save results summary to JSON."""
    results["total_elapsed"] = elapsed
    summary_path = Path(output_dir) / "e2e_summary.json"
    with open(summary_path, "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2, default=str)


def _print_summary(results: dict, elapsed: float, output_dir: str):
    """Print final summary."""
    print("\n" + "=" * 60)
    print("📊 INTEGRATION E2E SUMMARY")
    print("=" * 60)
    print(f"   Job ID: {results['job_id']}")
    print(f"   Total time: {elapsed:.1f}s")
    print()

    for stage, data in results["stages"].items():
        status = data.get("status", "completed")
        symbol = "✅" if status in ("completed", "mock") else "❌" if status == "failed" else "⏭️"
        stage_time = f" ({data.get('elapsed', 0):.1f}s)" if "elapsed" in data else ""
        print(f"   {symbol} {stage}{stage_time}: {status}")

    # Final verdict
    all_ok = all(
        s.get("status") in ("completed", "mock", "skipped")
        for s in results["stages"].values()
    )
    print()
    if all_ok:
        print("   🎉 ALL STAGES PASSED")
    else:
        print("   ❌ SOME STAGES FAILED")

    print(f"\n   📁 Results: {output_dir}/")


if __name__ == "__main__":
    main()
