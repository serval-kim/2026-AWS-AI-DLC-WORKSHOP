"""OpenSearch vector store for the traffic-accident RAG.

Auth modes (chosen by env, in priority order):
- Basic auth: set ``OPENSEARCH_BASIC_AUTH_USER`` + ``OPENSEARCH_BASIC_AUTH_PASSWORD``.
  Used when the domain has Fine-Grained Access Control with a master user.
- SigV4: default. ``OPENSEARCH_SERVERLESS=1`` signs against service ``aoss``,
  otherwise against managed service ``es``.

Index mapping uses ``knn_vector`` with HNSW (cosine, FAISS engine).

Required env (set after creating the cluster):
    OPENSEARCH_ENDPOINT             https://...
    OPENSEARCH_INDEX                e.g. accident-law (default)
    OPENSEARCH_SERVERLESS           1 if Serverless, 0/unset for managed
    OPENSEARCH_BASIC_AUTH_USER      master user (FGAC), optional
    OPENSEARCH_BASIC_AUTH_PASSWORD  master password, optional
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Iterable

import boto3
from opensearchpy import OpenSearch, RequestsHttpConnection, helpers
from requests_aws4auth import AWS4Auth

logger = logging.getLogger(__name__)

DEFAULT_INDEX = "accident-law"
DEFAULT_VECTOR_FIELD = "embedding"
DEFAULT_TEXT_FIELD = "text"


def _resolve_endpoint(endpoint: str | None) -> str:
    endpoint = endpoint or os.environ.get("OPENSEARCH_ENDPOINT", "").strip()
    if not endpoint:
        raise RuntimeError(
            "OPENSEARCH_ENDPOINT is required. Set it in .env."
        )
    if not endpoint.startswith("https://"):
        raise ValueError(f"OPENSEARCH_ENDPOINT must be https://, got {endpoint!r}")
    return endpoint.replace("https://", "").rstrip("/")


def _is_serverless() -> bool:
    return os.environ.get("OPENSEARCH_SERVERLESS", "0").lower() in {"1", "true", "yes"}


def _basic_auth_credentials() -> tuple[str, str] | None:
    user = os.environ.get("OPENSEARCH_BASIC_AUTH_USER", "").strip()
    pwd = os.environ.get("OPENSEARCH_BASIC_AUTH_PASSWORD", "")
    if user and pwd:
        return user, pwd
    return None


def _build_sigv4_auth(region: str) -> AWS4Auth:
    session = boto3.Session()
    creds = session.get_credentials()
    if creds is None:
        raise RuntimeError(
            "AWS credentials not found. Configure env vars or ~/.aws/credentials."
        )
    frozen = creds.get_frozen_credentials()
    service = "aoss" if _is_serverless() else "es"
    return AWS4Auth(
        frozen.access_key,
        frozen.secret_key,
        region,
        service,
        session_token=frozen.token,
    )


@dataclass
class OpenSearchVectorStore:
    """Thin wrapper around opensearch-py for vector ingest + k-NN search."""

    region: str
    endpoint: str | None = None
    index: str = DEFAULT_INDEX
    vector_field: str = DEFAULT_VECTOR_FIELD
    text_field: str = DEFAULT_TEXT_FIELD
    dimensions: int = 1024

    def __post_init__(self) -> None:
        host = _resolve_endpoint(self.endpoint)
        basic = _basic_auth_credentials()
        if basic is not None:
            http_auth: Any = basic
            self._auth_mode = "basic"
        else:
            http_auth = _build_sigv4_auth(self.region)
            self._auth_mode = "sigv4"
        self._client = OpenSearch(
            hosts=[{"host": host, "port": 443}],
            http_auth=http_auth,
            use_ssl=True,
            verify_certs=True,
            connection_class=RequestsHttpConnection,
            timeout=60,
            max_retries=3,
            retry_on_timeout=True,
        )
        self._serverless = _is_serverless()
        logger.info("OpenSearch client ready (auth=%s, serverless=%s)", self._auth_mode, self._serverless)

    # -- index management -------------------------------------------------

    def index_mapping(self) -> dict[str, Any]:
        """Return the index body. ``knn`` setting is omitted on Serverless
        because it is enabled at collection level."""
        mapping = {
            "mappings": {
                "properties": {
                    self.vector_field: {
                        "type": "knn_vector",
                        "dimension": self.dimensions,
                        "method": {
                            "name": "hnsw",
                            "engine": "faiss",
                            "space_type": "cosinesimil",
                            "parameters": {"ef_construction": 256, "m": 16},
                        },
                    },
                    self.text_field: {"type": "text"},
                    "chunk_id": {"type": "keyword"},
                    "article_no": {"type": "keyword"},
                    "article_title": {"type": "keyword"},
                    "source": {"type": "keyword"},
                    "page_hint": {"type": "integer"},
                }
            }
        }
        if not self._serverless:
            mapping["settings"] = {"index": {"knn": True}}
        return mapping

    def ensure_index(self) -> None:
        if self._client.indices.exists(index=self.index):
            logger.info("Index %s already exists; skipping create", self.index)
            return
        logger.info("Creating index %s (dim=%d)", self.index, self.dimensions)
        self._client.indices.create(index=self.index, body=self.index_mapping())

    def drop_index(self) -> None:
        if self._client.indices.exists(index=self.index):
            self._client.indices.delete(index=self.index)
            logger.info("Dropped index %s", self.index)

    # -- write ------------------------------------------------------------

    def bulk_upsert(self, docs: Iterable[dict[str, Any]]) -> int:
        """Bulk index documents. ``docs`` must contain ``chunk_id`` and
        ``embedding`` already populated.

        OpenSearch Serverless does NOT support custom ``_id`` on Bulk indexing
        in older API versions; we therefore omit ``_id`` on Serverless and
        rely on ``chunk_id`` as the dedup key for application-side logic.
        """
        actions: list[dict[str, Any]] = []
        for d in docs:
            action: dict[str, Any] = {
                "_op_type": "index",
                "_index": self.index,
                "_source": d,
            }
            if not self._serverless and "chunk_id" in d:
                action["_id"] = d["chunk_id"]
            actions.append(action)

        if not actions:
            return 0
        success, errors = helpers.bulk(
            self._client,
            actions,
            raise_on_error=False,
            request_timeout=120,
        )
        if errors:
            logger.warning("Bulk upsert had %d errors. First: %s", len(errors), errors[:1])
        return success

    # -- read -------------------------------------------------------------

    def knn_search(
        self,
        query_vector: list[float],
        *,
        k: int = 5,
        source_filter: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        body: dict[str, Any] = {
            "size": k,
            "query": {
                "knn": {
                    self.vector_field: {
                        "vector": query_vector,
                        "k": k,
                    }
                }
            },
        }
        if source_filter:
            body["_source"] = source_filter

        resp = self._client.search(index=self.index, body=body)
        hits = resp.get("hits", {}).get("hits", [])
        return [
            {
                "score": h.get("_score"),
                **h.get("_source", {}),
            }
            for h in hits
        ]

    def count(self) -> int:
        resp = self._client.count(index=self.index)
        return int(resp.get("count", 0))


def store_from_env(*, region: str, dimensions: int = 1024) -> OpenSearchVectorStore:
    """Construct a store using OPENSEARCH_* env vars."""
    return OpenSearchVectorStore(
        region=region,
        endpoint=os.environ.get("OPENSEARCH_ENDPOINT"),
        index=os.environ.get("OPENSEARCH_INDEX", DEFAULT_INDEX),
        dimensions=dimensions,
    )


# Avoid unused-import warning for json on some linters; helpers may use it.
_ = json
