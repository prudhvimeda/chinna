"""
Chinna Provider Interfaces — Abstract base classes for all providers.
"""

from abc import ABC, abstractmethod
from typing import AsyncGenerator, Optional
import logging

logger = logging.getLogger(__name__)


class ASRProvider(ABC):
    """Abstract Speech Recognition provider."""

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the ASR model/connection."""
        pass

    @abstractmethod
    async def transcribe(self, audio_data: bytes) -> str:
        """Transcribe audio bytes to text.

        Args:
            audio_data: Raw audio bytes (PCM16, 16kHz, mono)

        Returns:
            Transcribed text string
        """
        pass

    @abstractmethod
    async def shutdown(self) -> None:
        """Cleanup resources."""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name for logging."""
        pass


class LLMProvider(ABC):
    """Abstract Language Model provider."""

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the LLM connection."""
        pass

    @abstractmethod
    async def generate_stream(
        self,
        messages: list[dict],
        system_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 512,
    ) -> AsyncGenerator[str, None]:
        """Stream generated tokens.

        Args:
            messages: Conversation history
            system_prompt: System prompt for personality
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate

        Yields:
            Individual tokens as strings
        """
        pass

    @abstractmethod
    async def shutdown(self) -> None:
        """Cleanup resources."""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name for logging."""
        pass


class TTSProvider(ABC):
    """Abstract Text-to-Speech provider."""

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the TTS model/connection."""
        pass

    @abstractmethod
    async def synthesize(self, text: str) -> tuple[bytes, int]:
        """Synthesize text to audio.

        Args:
            text: Text to convert to speech

        Returns:
            Tuple of (audio_bytes, sample_rate)
        """
        pass

    @abstractmethod
    async def synthesize_stream(self, text: str) -> AsyncGenerator[tuple[bytes, int], None]:
        """Stream synthesized audio chunks.

        Args:
            text: Text to convert to speech

        Yields:
            Tuples of (audio_chunk_bytes, sample_rate)
        """
        pass

    @abstractmethod
    async def shutdown(self) -> None:
        """Cleanup resources."""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name for logging."""
        pass

    @property
    def sample_rate(self) -> int:
        """Default sample rate."""
        return 24000
