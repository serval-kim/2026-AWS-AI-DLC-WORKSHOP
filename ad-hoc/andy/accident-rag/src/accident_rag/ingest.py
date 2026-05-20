"""End-to-end ingest: PDF -> chunk -> embed -> OpenSearch.

Honors a ``limit`` so the user can do the requested 100-chunk PoC quickly.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from accident_rag.embeddings import (
    DEFAULT_EMBED_MODEL_ID,
    EmbeddingClient,
)
from accident_rag.opensearch_store import (
    OpenSearchVectorStore,
    store_from_env,
)
from accident_rag.pdf_loader import load_chunks

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class IngestSummary:
    pdf: str
    total_chunks_extracted: int
    chunks_embedded: int
    chunks_indexed: int
    index: str
    embed_model: str
    dimensions: int


def ingest_pdf(
    pdf_path: Path | str,
    *,
    region: str | None = None,
    limit: int = 10,
    embed_model: str = DEFAULT_EMBED_MODEL_ID,
    dimensions: int = 1024,
    recreate_index: bool = False,
    store: OpenSearchVectorStore | None = None,
    sleep_between_embeds: float = 0.0,
) -> IngestSummary:
    """Run the full ingestion pipeline.

    Args:
        pdf_path: Source PDF (e.g. ``~/Downloads/law.pdf``).
        region: AWS region. Defaults to ``AWS_REGION`` env or us-east-1.
        limit: Hard cap on number of chunks to embed and index. PoC=10.
        embed_model: Bedrock embedding model id.
        dimensions: Vector dimension. Must match the OpenSearch index mapping.
        recreate_index: If True, drop and recreate the index before indexing.
        store: Optional pre-built OpenSearchVectorStore (testing/injection).
        sleep_between_embeds: Throttle helper for noisy quotas.
    """
    pdf_path = Path(pdf_path).expanduser()
    region = region or os.environ.get("AWS_REGION", "us-east-1")

    # 1. Load + chunk
    chunks = load_chunks(pdf_path)
    extracted = len(chunks)
    if limit > 0:
        chunks = chunks[:limit]
    logger.info("Will embed %d / %d chunks", len(chunks), extracted)

    if not chunks:
        raise RuntimeError(f"No chunks produced from {pdf_path}")

    # 2. Embed
    embed_client = EmbeddingClient(
        region=region,
        model_id=embed_model,
        dimensions=dimensions,
    )
    texts = [c.text for c in chunks]
    vectors = embed_client.embed_many(texts, sleep_between=sleep_between_embeds)
    if len(vectors) != len(chunks):
        raise RuntimeError(
            f"Embedding count mismatch: {len(vectors)} vs {len(chunks)} chunks"
        )

    # 3. OpenSearch
    if store is None:
        store = store_from_env(region=region, dimensions=dimensions)
    if recreate_index:
        store.drop_index()
    store.ensure_index()

    docs: list[dict[str, Any]] = []
    for chunk, vec in zip(chunks, vectors):
        docs.append(
            {
                "chunk_id": chunk.chunk_id,
                "article_no": chunk.article_no,
                "article_title": chunk.article_title,
                "text": chunk.text,
                "source": chunk.source,
                "page_hint": chunk.page_hint,
                store.vector_field: vec,
            }
        )
    indexed = store.bulk_upsert(docs)

    summary = IngestSummary(
        pdf=str(pdf_path),
        total_chunks_extracted=extracted,
        chunks_embedded=len(vectors),
        chunks_indexed=indexed,
        index=store.index,
        embed_model=embed_model,
        dimensions=dimensions,
    )
    logger.info("Ingest summary: %s", summary)
    return summary
