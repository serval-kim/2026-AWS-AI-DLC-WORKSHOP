"""RQ task definitions for the worker."""

from worker.pipeline import AnalysisPipeline


def run_analysis(job_id: str, video_s3_key: str, callback_url: str) -> None:
    """RQ task: run the full analysis pipeline."""
    pipeline = AnalysisPipeline()
    pipeline.run(job_id=job_id, video_s3_key=video_s3_key, callback_url=callback_url)
