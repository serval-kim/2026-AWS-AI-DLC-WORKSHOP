"""Integration API — E2E 파이프라인 오케스트레이션"""
import json
import os
import uuid
from pathlib import Path

# Mock mode: 실제 영상 생성 스킵
MOCK_MODE = os.environ.get("MOCK_VIDEO_GEN", "true").lower() == "true"

# 경로 설정
BASE_DIR = Path(__file__).parent.parent
JUAN_MODULE = BASE_DIR / "ad-hoc" / "juan" / "hanmuncheol-reels"
SSOL_MOCK_OUTPUT = BASE_DIR / "ad-hoc" / "ssol" / "mock-output" / "muncheol-script-oneshot.json"
OUTPUT_DIR = Path("/tmp/integration_output")


def run_pipeline(analysis_result: dict = None, video_path: str = None) -> dict:
    """
    전체 파이프라인 실행.
    
    입력: Serval의 StructuredAnalysis (또는 None이면 mock 사용)
    출력: {job_id, script, videoUrl, audioUrl, status}
    """
    job_id = str(uuid.uuid4())[:8]
    job_dir = OUTPUT_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    # Step 1: Serval → Ssol 변환
    if analysis_result:
        from adapters.serval_to_ssol import structured_analysis_to_pipeline_input
        pipeline_input = structured_analysis_to_pipeline_input(analysis_result)
        # TODO: Ssol LLM 호출로 muncheol-script 생성
        # 현재는 mock 출력 사용
        script = _load_mock_script()
    else:
        script = _load_mock_script()

    # Step 2: 스크립트 저장
    script_path = job_dir / "script.json"
    with open(script_path, "w") as f:
        json.dump(script, f, ensure_ascii=False, indent=2)

    # Step 3: Juan 모듈 실행 (TTS + 영상 생성)
    import sys
    sys.path.insert(0, str(JUAN_MODULE))
    os.environ["MOCK_VIDEO_GEN"] = "true" if MOCK_MODE else "false"

    from pipeline import run_pipeline as juan_pipeline
    output_path = juan_pipeline(str(script_path), str(job_dir / "output"))

    # Step 4: 결과 수집
    output_dir = job_dir / "output"
    video_file = output_dir / "hanmuncheol_reels.mp4"
    # TTS는 씬별로 생성됨 — intro + analysis + conclusion concat 필요
    audio_files = sorted(output_dir.glob("*_tts.mp3"))

    return {
        "job_id": job_id,
        "status": "completed",
        "script": script,
        "videoPath": str(video_file) if video_file.exists() else None,
        "audioPaths": [str(f) for f in audio_files],
        "outputDir": str(output_dir),
    }


def _load_mock_script() -> dict:
    """Ssol의 mock 출력 로드"""
    with open(SSOL_MOCK_OUTPUT) as f:
        return json.load(f)


if __name__ == "__main__":
    print("Running integration pipeline (MOCK mode)...")
    result = run_pipeline()
    print(f"\nResult:")
    print(f"  job_id: {result['job_id']}")
    print(f"  status: {result['status']}")
    print(f"  video: {result['videoPath']}")
    print(f"  audio: {result['audioPaths']}")
