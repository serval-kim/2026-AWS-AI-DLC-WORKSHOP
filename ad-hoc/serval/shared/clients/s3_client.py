"""S3 client for file operations and job status management."""

import json
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

from shared.config import settings
from shared.logging import get_logger
from shared.models.job import AnalysisJob, JobStatus

logger = get_logger(__name__)


class S3Client:
    """Client for S3 operations including job status via object metadata."""

    def __init__(self) -> None:
        session_kwargs = {
            "aws_access_key_id": settings.aws_access_key_id,
            "aws_secret_access_key": settings.aws_secret_access_key,
            "region_name": settings.effective_region,
        }
        if settings.aws_session_token:
            session_kwargs["aws_session_token"] = settings.aws_session_token

        self._client = boto3.client("s3", **session_kwargs)
        self._bucket = settings.s3_bucket_name

    def download_file(self, s3_key: str, local_path: str) -> str:
        """Download a file from S3 to local path."""
        logger.info("s3_download_start", s3_key=s3_key, local_path=local_path)
        Path(local_path).parent.mkdir(parents=True, exist_ok=True)
        self._client.download_file(self._bucket, s3_key, local_path)
        logger.info("s3_download_complete", s3_key=s3_key)
        return local_path

    def upload_file(self, local_path: str, s3_key: str) -> str:
        """Upload a local file to S3."""
        logger.info("s3_upload_start", local_path=local_path, s3_key=s3_key)
        self._client.upload_file(local_path, self._bucket, s3_key)
        logger.info("s3_upload_complete", s3_key=s3_key)
        return s3_key

    def upload_json(self, data: dict, s3_key: str) -> str:
        """Upload JSON data directly to S3."""
        logger.info("s3_upload_json", s3_key=s3_key)
        body = json.dumps(data, ensure_ascii=False, default=str)
        self._client.put_object(
            Bucket=self._bucket,
            Key=s3_key,
            Body=body.encode("utf-8"),
            ContentType="application/json",
        )
        return s3_key

    def download_json(self, s3_key: str) -> dict:
        """Download and parse JSON from S3."""
        response = self._client.get_object(Bucket=self._bucket, Key=s3_key)
        body = response["Body"].read().decode("utf-8")
        return json.loads(body)

    def get_job_status(self, job_id: str) -> AnalysisJob | None:
        """Get job status from S3 status object."""
        status_key = f"status/{job_id}.json"
        try:
            data = self.download_json(status_key)
            return AnalysisJob.model_validate(data)
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                return None
            raise

    def set_job_status(self, job: AnalysisJob) -> None:
        """Save job status to S3."""
        status_key = f"status/{job.job_id}.json"
        self.upload_json(job.model_dump(mode="json"), status_key)
        logger.info("job_status_updated", job_id=job.job_id, status=job.status)

    def file_exists(self, s3_key: str) -> bool:
        """Check if a file exists in S3."""
        try:
            self._client.head_object(Bucket=self._bucket, Key=s3_key)
            return True
        except ClientError:
            return False
