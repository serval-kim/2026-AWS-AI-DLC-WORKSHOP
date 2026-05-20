"""Integration API Server — FastAPI

흐름:
  POST /analyze (video_s3_key 필수)
    → Serval AnalysisPipeline 인프로세스 호출 → StructuredAnalysis
    → muncheol_translator (Bedrock 1회) → 문철어 스크립트
    → Juan 파이프라인 (TTS + Nova Reel)
"""
import json
import os
import sys
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn

BASE_DIR = Path(__file__).parent.parent
SERVAL_DIR = BASE_DIR / "ad-hoc" / "serval"
JUAN_DIR = BASE_DIR / "ad-hoc" / "juan" / "hanmuncheol-reels"

# Serval 먼저, Juan 나중에 insert → Juan의 `from config import` 우선 해결
sys.path.insert(0, str(SERVAL_DIR))
sys.path.insert(0, str(JUAN_DIR))

app = FastAPI(title="한문철 릴스 생성 API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

jobs: dict = {}


class AnalyzeRequest(BaseModel):
    video_s3_key: str
    mode: str = "parallel"  # juan video_gen mode: "serial" | "parallel"


def _run_serval_analysis(job_id: str, video_s3_key: str) -> dict:
    """Serval AnalysisPipeline을 인프로세스 호출 → StructuredAnalysis dict 반환."""
    from worker.pipeline import AnalysisPipeline
    from shared.clients.s3_client import S3Client

    pipeline = AnalysisPipeline()
    pipeline.run(job_id=job_id, video_s3_key=video_s3_key, callback_url="")

    s3 = S3Client()
    job = s3.get_job_status(job_id)
    if job is None or not job.result_keys.structured_analysis:
        raise RuntimeError(f"Serval structured_analysis 산출 실패: status={job.status if job else 'missing'}")

    return s3.download_json(job.result_keys.structured_analysis)


def _run_pipeline(job_id: str, video_s3_key: str, mode: str):
    output_dir = f"/tmp/jobs/{job_id}"
    os.makedirs(output_dir, exist_ok=True)
    try:
        structured = _run_serval_analysis(job_id, video_s3_key)
        jobs[job_id]["structured_analysis"] = structured

        from muncheol_translator import translate_to_muncheol
        script = translate_to_muncheol(structured)
        jobs[job_id]["script"] = script

        script_path = f"{output_dir}/script.json"
        with open(script_path, "w") as f:
            json.dump(script, f, ensure_ascii=False)

        from pipeline import run_pipeline as juan_pipeline
        result = juan_pipeline(script_path, f"{output_dir}/output", mode=mode)

        jobs[job_id]["status"] = "completed"
        jobs[job_id]["videoPath"] = result
        jobs[job_id]["outputDir"] = f"{output_dir}/output"
    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    """블랙박스 영상 → S3 업로드. video_s3_key 반환."""
    from shared.clients.s3_client import S3Client
    import uuid

    suffix = (file.filename or "video.mp4").rsplit(".", 1)[-1].lower()
    if suffix not in ("mp4", "mov", "avi"):
        suffix = "mp4"
    s3_key = f"accident-videos/upload-{uuid.uuid4().hex[:8]}.{suffix}"

    tmp_path = f"/tmp/upload_{uuid.uuid4().hex[:8]}.{suffix}"
    with open(tmp_path, "wb") as f:
        f.write(await file.read())

    s3 = S3Client()
    s3.upload_file(tmp_path, s3_key)
    os.remove(tmp_path)
    return {"video_s3_key": s3_key}


@app.post("/analyze")
async def analyze(req: AnalyzeRequest, background_tasks: BackgroundTasks):
    import uuid
    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {"status": "processing", "video_s3_key": req.video_s3_key}
    background_tasks.add_task(_run_pipeline, job_id, req.video_s3_key, req.mode)
    return {"job_id": job_id, "status": "processing"}


@app.get("/jobs/{job_id}")
async def get_job(job_id: str):
    if job_id not in jobs:
        return {"error": "not found"}, 404
    job = jobs[job_id]
    result = {
        "job_id": job_id,
        "status": job["status"],
        "script": job.get("script"),
        "structured_analysis": job.get("structured_analysis"),
    }
    if job["status"] == "completed":
        result["videoUrl"] = f"/files/{job_id}/hanmuncheol_reels.mp4"
        result["audioUrls"] = {
            "intro": f"/files/{job_id}/intro_tts.mp3",
            "analysis": f"/files/{job_id}/analysis_tts.mp3",
            "conclusion": f"/files/{job_id}/conclusion_tts.mp3",
        }
    elif job["status"] == "failed":
        result["error"] = job.get("error")
    return result


@app.get("/files/{job_id}/{filename}")
async def serve_file(job_id: str, filename: str):
    path = Path(f"/tmp/jobs/{job_id}/output/{filename}")
    if path.exists():
        media_type = "video/mp4" if filename.endswith(".mp4") else "audio/mpeg"
        return FileResponse(path, media_type=media_type)
    return {"error": "not found"}, 404


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
