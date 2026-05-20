"""Test Bedrock Titan Embed V2 call (no OpenSearch needed)."""
from dotenv import load_dotenv
load_dotenv()

from accident_rag.embeddings import EmbeddingClient

client = EmbeddingClient(region="us-east-1")
try:
    vec = client.embed_one("교통사고 과실비율 테스트")
    print(f"OK: dim={len(vec)}, first3={vec[:3]}")
except Exception as e:
    print(f"FAILED: {type(e).__name__}: {e}")
