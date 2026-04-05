"""
Ollama LLM Provider — Local language model via Ollama.
Supports Llama 3.2, Qwen 2.5, and any Ollama-compatible model.
"""

import asyncio
import logging
from typing import AsyncGenerator

from providers.base import LLMProvider

logger = logging.getLogger(__name__)


class OllamaLLMProvider(LLMProvider):
    """Language model provider using local Ollama server."""

    def __init__(
        self,
        model: str = "llama3.2:3b",
        host: str = "http://localhost:11434",
        temperature: float = 0.3,
        max_tokens: int = 512,
    ):
        self.model = model
        self.host = host
        self.temperature = temperature
        self.max_tokens = max_tokens
        self._client = None

    async def initialize(self) -> None:
        """Initialize the Ollama client and verify model availability."""
        logger.info(f"Connecting to Ollama at {self.host} with model '{self.model}'...")

        try:
            import ollama
            self._client = ollama.AsyncClient(host=self.host)

            # Verify the model is available
            models = await self._client.list()
            model_names = [m.model for m in models.models] if models.models else []

            if not any(self.model in name for name in model_names):
                logger.warning(
                    f"Model '{self.model}' not found locally. "
                    f"Available: {model_names}. "
                    f"Run: ollama pull {self.model}"
                )
            else:
                logger.info(f"✅ Ollama model '{self.model}' ready.")

        except Exception as e:
            logger.error(f"Failed to connect to Ollama: {e}")
            logger.error("Make sure Ollama is running: 'ollama serve'")
            raise

    async def generate_stream(
        self,
        messages: list[dict],
        system_prompt: str,
        temperature: float = None,
        max_tokens: int = None,
    ) -> AsyncGenerator[str, None]:
        """Stream tokens from the LLM.

        Args:
            messages: Conversation history [{"role": "user", "content": "..."}]
            system_prompt: System prompt for Chinna personality
            temperature: Override default temperature
            max_tokens: Override default max tokens

        Yields:
            Individual tokens as strings
        """
        if self._client is None:
            raise RuntimeError("Ollama client not initialized. Call initialize() first.")

        temp = temperature if temperature is not None else self.temperature
        max_tok = max_tokens if max_tokens is not None else self.max_tokens

        # Build full message list with system prompt
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        try:
            stream = await self._client.chat(
                model=self.model,
                messages=full_messages,
                stream=True,
                options={
                    "temperature": temp,
                    "num_predict": max_tok,
                    "repeat_penalty": 1.1,
                    "top_p": 0.9,
                    "top_k": 40,
                },
            )

            async for chunk in stream:
                token = chunk.message.content
                if token:
                    yield token

        except Exception as e:
            logger.error(f"Ollama generation error: {e}")
            yield f"I apologize, but I encountered an error: {str(e)}"

    async def generate(
        self,
        messages: list[dict],
        system_prompt: str,
        temperature: float = None,
        max_tokens: int = None,
    ) -> str:
        """Generate a complete response (non-streaming).

        Returns:
            Complete response text
        """
        tokens = []
        async for token in self.generate_stream(messages, system_prompt, temperature, max_tokens):
            tokens.append(token)
        return "".join(tokens)

    async def shutdown(self) -> None:
        """Cleanup the client."""
        self._client = None
        logger.info("Ollama client disconnected.")

    @property
    def name(self) -> str:
        return f"Ollama ({self.model})"
