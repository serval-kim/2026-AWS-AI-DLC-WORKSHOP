"""AWS Bedrock client for LLM and embedding operations."""

import json

import boto3

from shared.config import settings
from shared.logging import get_logger

logger = get_logger(__name__)


class LLMResponse:
    """Response from Bedrock LLM invocation."""

    def __init__(self, content: str, thinking: str = "", input_tokens: int = 0, output_tokens: int = 0):
        self.content = content
        self.thinking = thinking
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens


class BedrockClient:
    """Client for AWS Bedrock LLM and embedding operations."""

    def __init__(self) -> None:
        session_kwargs = {
            "aws_access_key_id": settings.aws_access_key_id,
            "aws_secret_access_key": settings.aws_secret_access_key,
            "region_name": settings.effective_region,
        }
        if settings.aws_session_token:
            session_kwargs["aws_session_token"] = settings.aws_session_token

        self._client = boto3.client("bedrock-runtime", **session_kwargs)

    def invoke_with_thinking(self, prompt: str, context: str = "", max_tokens: int | None = None) -> LLMResponse:
        """Invoke LLM using Converse API (supports all Bedrock models)."""
        max_tokens = max_tokens or settings.bedrock_max_tokens
        logger.info("bedrock_invoke_start", model=settings.bedrock_model_id)

        user_content = f"Context:\n{context}\n\nRequest:\n{prompt}" if context else prompt

        messages = [{"role": "user", "content": [{"text": user_content}]}]

        kwargs = {
            "modelId": settings.bedrock_model_id,
            "messages": messages,
            "inferenceConfig": {"maxTokens": max_tokens, "temperature": 0.1},
        }

        response = self._client.converse(**kwargs)

        content = ""
        thinking = ""
        for block in response.get("output", {}).get("message", {}).get("content", []):
            if "text" in block:
                content = block["text"]
            elif "reasoningContent" in block:
                thinking = block["reasoningContent"].get("reasoningText", {}).get("text", "")

        usage = response.get("usage", {})
        logger.info(
            "bedrock_invoke_complete",
            input_tokens=usage.get("inputTokens", 0),
            output_tokens=usage.get("outputTokens", 0),
        )

        return LLMResponse(
            content=content,
            thinking=thinking,
            input_tokens=usage.get("inputTokens", 0),
            output_tokens=usage.get("outputTokens", 0),
        )

    def generate_embedding(self, text: str) -> list[float]:
        """Generate embedding vector using Titan Embeddings."""
        body = {"inputText": text}

        response = self._client.invoke_model(
            modelId=settings.bedrock_embedding_model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body),
        )

        result = json.loads(response["body"].read())
        return result["embedding"]

    def generate_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for multiple texts."""
        embeddings = []
        for text in texts:
            embedding = self.generate_embedding(text)
            embeddings.append(embedding)
        return embeddings
