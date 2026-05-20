"""Data ingestion CLI - load legal data into OpenSearch."""

import json
from pathlib import Path

from shared.clients import BedrockClient, OpenSearchClient
from shared.config import settings
from shared.logging import setup_logging, get_logger

setup_logging()
logger = get_logger(__name__)


class DataIngestion:
    """Ingests legal/precedent data into OpenSearch for RAG."""

    def __init__(self) -> None:
        self._bedrock = BedrockClient()
        self._opensearch = OpenSearchClient()

    def load_data(self, source_path: str) -> list[dict]:
        """Load documents from source directory."""
        documents = []
        source = Path(source_path)

        if not source.exists():
            logger.warning("data_source_not_found", path=source_path)
            return documents

        for file_path in source.rglob("*.json"):
            with open(file_path, encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    documents.extend(data)
                else:
                    documents.append(data)

        for file_path in source.rglob("*.txt"):
            text = file_path.read_text(encoding="utf-8")
            documents.append({
                "text": text,
                "source": file_path.stem,
                "category": "law" if "법" in file_path.stem else "precedent",
            })

        logger.info("data_loaded", document_count=len(documents))
        return documents

    def chunk_documents(self, documents: list[dict], chunk_size: int = 500, overlap: int = 100) -> list[dict]:
        """Split documents into chunks for embedding."""
        chunks = []

        for doc in documents:
            text = doc.get("text", "")
            source = doc.get("source", "unknown")
            category = doc.get("category", "law")

            if len(text) <= chunk_size:
                chunks.append({"text": text, "source": source, "category": category})
                continue

            # Split by sentences/paragraphs
            words = text.split()
            for i in range(0, len(words), chunk_size - overlap):
                chunk_words = words[i:i + chunk_size]
                chunk_text = " ".join(chunk_words)
                chunks.append({"text": chunk_text, "source": source, "category": category})

        logger.info("documents_chunked", total_chunks=len(chunks))
        return chunks

    def embed_chunks(self, chunks: list[dict], batch_size: int = 25) -> list[dict]:
        """Generate embeddings for chunks using Titan Embeddings."""
        embedded = []

        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            texts = [c["text"] for c in batch]
            vectors = self._bedrock.generate_embeddings_batch(texts)

            for chunk, vector in zip(batch, vectors):
                embedded.append({
                    "text": chunk["text"],
                    "source": chunk["source"],
                    "category": chunk["category"],
                    "vector": vector,
                    "metadata": {"source": chunk["source"]},
                })

            logger.info("embedding_batch_complete", batch=i // batch_size + 1, total=len(embedded))

        return embedded

    def ingest_to_opensearch(self, embedded_chunks: list[dict]) -> dict:
        """Ingest embedded chunks into OpenSearch."""
        # Ensure index exists
        self._opensearch.create_index()

        # Bulk index
        result = self._opensearch.bulk_index(embedded_chunks)
        logger.info("ingestion_complete", success=result["success"], failed=result["failed"])
        return result

    def run(self, source_path: str = "data/legal") -> dict:
        """Run the full ingestion pipeline."""
        logger.info("ingestion_start", source_path=source_path)

        documents = self.load_data(source_path)
        if not documents:
            logger.warning("no_documents_found")
            return {"total": 0, "success": 0, "failed": 0}

        chunks = self.chunk_documents(documents)
        embedded = self.embed_chunks(chunks)
        result = self.ingest_to_opensearch(embedded)

        return {"total": len(chunks), **result}


if __name__ == "__main__":
    ingestion = DataIngestion()
    result = ingestion.run()
    print(f"Ingestion complete: {result}")
