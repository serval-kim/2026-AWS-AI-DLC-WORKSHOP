"""Bedrock Titan Text Embeddings V2 wrapper.

Why Titan V2:
- 다국어(한국어 포함) 품질이 V1보다 향상되어 한국 법령 텍스트에 적합.
- 1024/512/256 차원 선택 가능. 본 PoC는 1024차원으로 시작 (정확도 우선).
- Bedrock 인증 흐름이 본 패키지의 다른 호출과 동일 (boto3 자격증명 체인).

Auth note: ``AWS_BEARER_TOKEN_BEDROCK`` (Bedrock API key) 가 설정돼 있으면
boto3가 자동 감지하여 사용. 그 외에는 SigV4.
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Any, Iterable, Sequence

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

DEFAULT_EMBED_MODEL_ID = "amazon.titan-embed-text-v2:0"
DEFAULT_DIMENSIONS = 1024  # 1024 | 512 | 256
DEFAULT_NORMALIZE = True

# Titan V2 입력 토큰 한도는 8192. 본 패키지의 PDF 청크는 최대 1200자
# (~800 토큰)로 제한되므로 안전 마진이 충분.
TITAN_INPUT_TOKEN_LIMIT = 8192


@dataclass(frozen=True)
class EmbeddingClient:
    """Stateful embedding client. Reuse one instance for batch ingestion."""

    region: str
    model_id: str = DEFAULT_EMBED_MODEL_ID
    dimensions: int = DEFAULT_DIMENSIONS
    normalize: bool = DEFAULT_NORMALIZE

    def __post_init__(self) -> None:
        if self.dimensions not in (256, 512, 1024):
            raise ValueError("Titan V2 supports dimensions in {256, 512, 1024}")
        if not self.region:
            raise ValueError("region is required")

    def _client(self) -> Any:
        config = Config(
            region_name=self.region,
            read_timeout=60,
            connect_timeout=10,
            retries={"max_attempts": 5, "mode": "standard"},
        )
        return boto3.client("bedrock-runtime", config=config)

    def embed_one(self, text: str) -> list[float]:
        """Embed a single string. Returns the dense vector."""
        if not text or not text.strip():
            raise ValueError("Cannot embed empty text")
        body = {
            "inputText": text,
            "dimensions": self.dimensions,
            "normalize": self.normalize,
        }
        try:
            resp = self._client().invoke_model(
                modelId=self.model_id,
                body=json.dumps(body),
                contentType="application/json",
                accept="application/json",
            )
        except ClientError:
            logger.exception("Bedrock embedding invoke_model failed")
            raise

        payload = json.loads(resp["body"].read())
        vec = payload.get("embedding")
        if not isinstance(vec, list):
            raise RuntimeError(f"Unexpected Titan response: {payload!r}")
        return vec

    def embed_many(
        self,
        texts: Sequence[str],
        *,
        sleep_between: float = 0.0,
    ) -> list[list[float]]:
        """Embed a batch sequentially.

        Titan V2 invoke_model은 단일 입력만 받으므로 순차 호출. 100건 PoC
        에서는 충분히 빠르고 retry로 throttling을 처리한다.
        """
        out: list[list[float]] = []
        for i, text in enumerate(texts):
            out.append(self.embed_one(text))
            if sleep_between and i < len(texts) - 1:
                time.sleep(sleep_between)
        return out


def embed_texts(
    texts: Iterable[str],
    *,
    region: str | None = None,
    model_id: str | None = None,
    dimensions: int = DEFAULT_DIMENSIONS,
) -> list[list[float]]:
    """Convenience wrapper for one-off embedding."""
    client = EmbeddingClient(
        region=region or os.environ.get("AWS_REGION", "us-east-1"),
        model_id=model_id or DEFAULT_EMBED_MODEL_ID,
        dimensions=dimensions,
    )
    return client.embed_many(list(texts))
