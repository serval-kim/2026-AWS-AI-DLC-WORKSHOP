"""Integration API Server — FastAPI"""
import os
import json
from pathlib import Path
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn

app = FastAPI(title="한문철 릴스 생성 API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# 상태 저장 (메모리)
jobs = {}

BASE_DIR = Path(__file__).parent.parent
SSOL_MOCK = BASE_DIR / "ad-hoc" / "ssol" / "mock-output" / "muncheol-script-oneshot.json"


def _run_juan_pipeline(job_id: str, script: dict, mode: str):
    """백그라운드에서 Juan 파이프라인 실행"""
    import sys
    sys.path.insert(0, str(BASE_DIR / "ad-hoc" / "juan" / "hanmuncheol-reels"))

    output_dir = f"/tmp/jobs/{job_id}"
    os.makedirs(output_dir, exist_ok=True)

    script_path = f"{output_dir}/script.json"
    with open(script_path, "w") as f:
        json.dump(script, f, ensure_ascii=False)

    os.environ["MOCK_VIDEO_GEN"] = os.environ.get("MOCK_VIDEO_GEN", "false")

    from pipeline import run_pipeline
    try:
        result = run_pipeline(script_path, f"{output_dir}/output", mode=mode)
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["videoPath"] = result
        jobs[job_id]["outputDir"] = f"{output_dir}/output"
    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)


@app.post("/analyze")
async def analyze(background_tasks: BackgroundTasks, mode: str = "parallel"):
    """파이프라인 시작 (mock script 사용)"""
    import uuid
    job_id = str(uuid.uuid4())[:8]

    with open(SSOL_MOCK) as f:
        script = json.load(f)

    jobs[job_id] = {"status": "processing", "script": script}
    background_tasks.add_task(_run_juan_pipeline, job_id, script, mode)

    return {"job_id": job_id, "status": "processing"}


@app.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """작업 상태 조회"""
    if job_id not in jobs:
        return {"error": "not found"}, 404
    job = jobs[job_id]
    result = {"job_id": job_id, "status": job["status"], "script": job.get("script")}
    if job["status"] == "completed":
        result["videoUrl"] = f"/files/{job_id}/hanmuncheol_reels.mp4"
        result["audioUrls"] = {
            "intro": f"/files/{job_id}/intro_tts.mp3",
            "analysis": f"/files/{job_id}/analysis_tts.mp3",
            "conclusion": f"/files/{job_id}/conclusion_tts.mp3",
        }
    return result


@app.get("/files/{job_id}/{filename}")
async def serve_file(job_id: str, filename: str):
    """생성된 파일 서빙"""
    path = Path(f"/tmp/jobs/{job_id}/output/{filename}")
    if path.exists():
        media_type = "video/mp4" if filename.endswith(".mp4") else "audio/mpeg"
        return FileResponse(path, media_type=media_type)
    return {"error": "not found"}, 404


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
