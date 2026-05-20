"""AWS service clients."""

from shared.clients.s3_client import S3Client
from shared.clients.bedrock_client import BedrockClient
from shared.clients.opensearch_client import OpenSearchClient

__all__ = ["S3Client", "BedrockClient", "OpenSearchClient"]
