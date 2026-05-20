"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # AWS
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_session_token: str = ""
    aws_default_region: str = "us-east-1"
    aws_region: str = ""

    # S3
    s3_bucket_name: str = "accident-analysis"

    # Bedrock
    bedrock_model_id: str = "us.deepseek.r1-v1:0"
    bedrock_embedding_model_id: str = "amazon.titan-embed-text-v2:0"
    bedrock_max_tokens: int = 4096
    bedrock_thinking_budget: int = 10000

    # OpenSearch Serverless
    opensearch_endpoint: str = ""
    opensearch_index_name: str = "legal-references"
    opensearch_vector_dimension: int = 1024

    # Redis
    redis_host: str = "redis"
    redis_port: int = 6379
    redis_queue_name: str = "analysis-jobs"

    # API Server
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_callback_url: str = "http://api-server:8000/callback"

    # Video Analysis
    video_extract_fps: int = 2
    video_min_resolution: int = 144
    video_max_file_size_mb: int = 500
    yolo_confidence_threshold: float = 0.5
    tracking_iou_threshold: float = 0.3
    tracking_min_frames: int = 2

    # RAG
    rag_top_k: int = 5
    rag_min_score: float = 0.5

    # Pipeline
    llm_max_retries: int = 2
    callback_max_retries: int = 3
    s3_timeout: int = 30
    opensearch_timeout: int = 15
    llm_timeout: int = 60

    model_config = {"env_file": "credentials.env", "env_file_encoding": "utf-8", "extra": "ignore"}

    @property
    def effective_region(self) -> str:
        """Get the effective AWS region."""
        return self.aws_region or self.aws_default_region or "us-east-1"


settings = Settings()
