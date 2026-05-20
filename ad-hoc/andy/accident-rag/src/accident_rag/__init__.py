"""Traffic-accident RAG: 도로교통법 PDF -> OpenSearch -> 과실비율 verdict.

Pipeline:
  PDF chunks -> Bedrock Titan Embed V2 -> OpenSearch k-NN
  query text -> top-k chunks -> Bedrock Claude -> structured JSON
"""

from accident_rag.embeddings import DEFAULT_EMBED_MODEL_ID, EmbeddingClient, embed_texts
from accident_rag.ingest import IngestSummary, ingest_pdf
from accident_rag.opensearch_store import DEFAULT_INDEX, OpenSearchVectorStore
from accident_rag.query import VerdictResponse, answer_query

__all__ = [
    "DEFAULT_EMBED_MODEL_ID",
    "DEFAULT_INDEX",
    "EmbeddingClient",
    "IngestSummary",
    "OpenSearchVectorStore",
    "VerdictResponse",
    "answer_query",
    "embed_texts",
    "ingest_pdf",
]

__version__ = "0.1.0"
