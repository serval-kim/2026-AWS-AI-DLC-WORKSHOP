"""Amazon OpenSearch Serverless client for vector search."""

import boto3
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth

from shared.config import settings
from shared.logging import get_logger

logger = get_logger(__name__)


class OpenSearchClient:
    """Client for Amazon OpenSearch Serverless vector operations."""

    def __init__(self) -> None:
        credentials = boto3.Session(
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region,
        ).get_credentials()

        auth = AWS4Auth(
            credentials.access_key,
            credentials.secret_key,
            settings.aws_region,
            "aoss",
            session_token=credentials.token,
        )

        self._client = OpenSearch(
            hosts=[{"host": settings.opensearch_endpoint, "port": 443}],
            http_auth=auth,
            use_ssl=True,
            verify_certs=True,
            connection_class=RequestsHttpConnection,
            timeout=settings.opensearch_timeout,
        )
        self._index = settings.opensearch_index_name

    def create_index(self, index_name: str | None = None, dimension: int | None = None) -> None:
        """Create a k-NN vector search index."""
        index_name = index_name or self._index
        dimension = dimension or settings.opensearch_vector_dimension

        if self._client.indices.exists(index=index_name):
            logger.info("opensearch_index_exists", index=index_name)
            return

        body = {
            "settings": {
                "index": {
                    "knn": True,
                }
            },
            "mappings": {
                "properties": {
                    "vector": {
                        "type": "knn_vector",
                        "dimension": dimension,
                        "method": {
                            "name": "hnsw",
                            "space_type": "cosinesimil",
                            "engine": "faiss",
                        },
                    },
                    "text": {"type": "text"},
                    "source": {"type": "keyword"},
                    "category": {"type": "keyword"},
                    "metadata": {"type": "object", "enabled": False},
                }
            },
        }

        self._client.indices.create(index=index_name, body=body)
        logger.info("opensearch_index_created", index=index_name, dimension=dimension)

    def bulk_index(self, documents: list[dict], index_name: str | None = None) -> dict:
        """Bulk index documents into OpenSearch."""
        index_name = index_name or self._index
        actions = []

        for doc in documents:
            actions.append({"index": {"_index": index_name}})
            actions.append(doc)

        if not actions:
            return {"success": 0, "failed": 0}

        response = self._client.bulk(body=actions)
        errors = sum(1 for item in response["items"] if item["index"].get("error"))
        success = len(documents) - errors

        logger.info("opensearch_bulk_complete", success=success, failed=errors)
        return {"success": success, "failed": errors}

    def search(self, query_vector: list[float], k: int | None = None, index_name: str | None = None) -> list[dict]:
        """Perform k-NN vector similarity search."""
        k = k or settings.rag_top_k
        index_name = index_name or self._index

        body = {
            "size": k,
            "query": {
                "knn": {
                    "vector": {
                        "vector": query_vector,
                        "k": k,
                    }
                }
            },
        }

        response = self._client.search(index=index_name, body=body)
        hits = response.get("hits", {}).get("hits", [])

        results = []
        for hit in hits:
            source = hit["_source"]
            results.append({
                "text": source.get("text", ""),
                "source": source.get("source", ""),
                "category": source.get("category", ""),
                "score": hit.get("_score", 0.0),
                "metadata": source.get("metadata", {}),
            })

        logger.info("opensearch_search_complete", results_count=len(results))
        return results
