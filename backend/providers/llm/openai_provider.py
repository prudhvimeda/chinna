"""
OpenAI LLM Provider — API compatible model provider.
Supports OpenAI, vLLM, LM Studio, Together AI, or any OpenAI-compatible API.
"""

import asyncio
import logging
from typing import AsyncGenerator

from providers.base import LLMProvider

logger = logging.getLogger(__name__)


class OpenAILLMProvider(LLMProvider):
    """Language model provider using OpenAI compatible API."""

    def __init__(
        self,
        model: str = "gpt-3.5-turbo",
        api_key: str = "sk-no-key-needed",
        base_url: str = "http://localhost:8000/v1",
        temperature: float = 0.3,
        max_tokens: int = 512,
    ):
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.temperature = temperature
        self.max_tokens = max_tokens
        self._client = None

    async def initialize(self) -> None:
        """Initialize the OpenAI client."""
        logger.info(f"Connecting to OpenAI API at {self.base_url} with model '{self.model}'...")

        try:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(
                api_key=self.api_key,
                base_url=self.base_url,
            )
            logger.info(f"✅ OpenAI compatible API model '{self.model}' ready.")

        except ImportError:
            logger.error("The 'openai' package is not installed. Please add it to your requirements.")
            raise
        except Exception as e:
            logger.error(f"Failed to connect to OpenAI API: {e}")
            raise

    async def generate_stream(
        self,
        messages: list[dict],
        system_prompt: str,
        temperature: float = None,
        max_tokens: int = None,
    ) -> AsyncGenerator[str, None]:
        """Stream tokens from the LLM."""
        if self._client is None:
            raise RuntimeError("OpenAI client not initialized. Call initialize() first.")

        temp = temperature if temperature is not None else self.temperature
        max_tok = max_tokens if max_tokens is not None else self.max_tokens
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        try:
            stream = await self._client.chat.completions.create(
                model=self.model,
                messages=full_messages,
                stream=True,
                temperature=temp,
                max_tokens=max_tok,
            )

            async for chunk in stream:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if delta and delta.content:
                        yield delta.content

        except Exception as e:
            logger.error(f"OpenAI generation error: {e}")
            yield f"I apologize, but I encountered an error: {str(e)}"

    async def generate(
        self,
        messages: list[dict],
        system_prompt: str,
        temperature: float = None,
        max_tokens: int = None,
    ) -> str:
        tokens = []
        async for token in self.generate_stream(messages, system_prompt, temperature, max_tokens):
            tokens.append(token)
        return "".join(tokens)

    async def shutdown(self) -> None:
        if self._client:
            await self._client.close()
            self._client = None
        logger.info("OpenAI client disconnected.")

    @property
    def name(self) -> str:
        return f"OpenAI API ({self.model})"
