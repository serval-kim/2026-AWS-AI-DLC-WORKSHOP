"""Query path: text -> embed -> k-NN -> Bedrock LLM -> structured JSON verdict.

Uses Bedrock Converse API with Claude Haiku 4.5 by default. The model id is
overridable via ``RAG_LLM_MODEL_ID`` to mirror the existing ``REVIEWER_MODEL_ID``
pattern in this package.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from accident_rag.embeddings import (
    DEFAULT_EMBED_MODEL_ID,
    EmbeddingClient,
)
from accident_rag.opensearch_store import (
    OpenSearchVectorStore,
    store_from_env,
)
from accident_rag.prompts import (
    VERDICT_SYSTEM_PROMPT,
    VERDICT_USER_TEMPLATE,
    build_context_block,
)

logger = logging.getLogger(__name__)

DEFAULT_LLM_MODEL_ID = "anthropic.claude-haiku-4-5-20251001-v1:0"


@dataclass
class VerdictResponse:
    """Final structured response surfaced to the caller / CLI."""

    query: str
    verdict: dict[str, Any]  # Parsed JSON from the LLM (or {} on failure)
    raw_text: str
    retrieved: list[dict[str, Any]] = field(default_factory=list)
    model_id: str = DEFAULT_LLM_MODEL_ID

    def to_dict(self) -> dict[str, Any]:
        return {
            "query": self.query,
            "verdict": self.verdict,
            "raw_text": self.raw_text,
            "retrieved": self.retrieved,
            "model_id": self.model_id,
        }


def _bedrock_runtime(region: str) -> Any:
    config = Config(
        region_name=region,
        read_timeout=120,
        connect_timeout=10,
        retries={"max_attempts": 3, "mode": "standard"},
    )
    return boto3.client("bedrock-runtime", config=config)


def _converse(
    client: Any,
    *,
    model_id: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.1,
    max_tokens: int = 1024,
) -> str:
    """Single-turn Bedrock Converse call. Returns text content."""
    try:
        resp = client.converse(
            modelId=model_id,
            system=[{"text": system_prompt}],
            messages=[{"role": "user", "content": [{"text": user_prompt}]}],
            inferenceConfig={
                "maxTokens": max_tokens,
                "temperature": temperature,
            },
        )
    except ClientError:
        logger.exception("Bedrock converse failed for model %s", model_id)
        raise

    blocks = resp.get("output", {}).get("message", {}).get("content", [])
    parts = [b.get("text", "") for b in blocks if "text" in b]
    return "".join(parts).strip()


def _parse_json_loose(text: str) -> dict[str, Any]:
    """Best-effort JSON extraction. Handles accidental code fences."""
    s = text.strip()
    if s.startswith("```"):
        # 코드펜스 제거
        s = s.strip("`")
        # 첫 줄이 'json' 같은 언어 태그면 제거
        nl = s.find("\n")
        if nl != -1 and s[:nl].strip().lower() in {"json", ""}:
            s = s[nl + 1 :]
    # 첫 '{' ~ 마지막 '}' 추출
    start = s.find("{")
    end = s.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {}
    try:
        return json.loads(s[start : end + 1])
    except json.JSONDecodeError:
        logger.warning("LLM returned non-JSON: %r", s[:200])
        return {}


def answer_query(
    query: str,
    *,
    region: str | None = None,
    k: int = 5,
    embed_model: str = DEFAULT_EMBED_MODEL_ID,
    dimensions: int = 1024,
    llm_model_id: str | None = None,
    store: OpenSearchVectorStore | None = None,
) -> VerdictResponse:
    """Run the RAG query and return a structured verdict.

    Args:
        query: 사고 상황 자유 텍스트 (한국어).
        region: AWS region.
        k: top-k retrieval count.
        embed_model: Bedrock embedding model id (must match ingest).
        dimensions: must match index mapping.
        llm_model_id: Bedrock chat model. Defaults to env or Claude Haiku 4.5.
        store: optional injected store (otherwise built from env).
    """
    if not query or not query.strip():
        raise ValueError("query must be non-empty")

    region = region or os.environ.get("AWS_REGION", "us-east-1")
    llm_model_id = llm_model_id or os.environ.get("RAG_LLM_MODEL_ID", DEFAULT_LLM_MODEL_ID)

    embed_client = EmbeddingClient(
        region=region,
        model_id=embed_model,
        dimensions=dimensions,
    )
    qvec = embed_client.embed_one(query)

    if store is None:
        store = store_from_env(region=region, dimensions=dimensions)

    hits = store.knn_search(
        qvec,
        k=k,
        source_filter=["chunk_id", "article_no", "article_title", "text", "source", "page_hint"],
    )
    logger.info("Retrieved %d chunks for query (k=%d)", len(hits), k)

    user_prompt = VERDICT_USER_TEMPLATE.format(
        accident_text=query.strip(),
        k=k,
        context_block=build_context_block(hits),
    )

    bedrock = _bedrock_runtime(region)
    raw_text = _converse(
        bedrock,
        model_id=llm_model_id,
        system_prompt=VERDICT_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        temperature=0.1,
        max_tokens=1200,
    )
    verdict = _parse_json_loose(raw_text)

    return VerdictResponse(
        query=query,
        verdict=verdict,
        raw_text=raw_text,
        retrieved=hits,
        model_id=llm_model_id,
    )
