"""
faster-whisper ASR Provider — Local speech recognition.
Uses CTranslate2 for 4x faster inference than OpenAI Whisper.
"""

import asyncio
import io
import logging
import numpy as np
from typing import Optional

from providers.base import ASRProvider

logger = logging.getLogger(__name__)


class WhisperASRProvider(ASRProvider):
    """Speech recognition using faster-whisper (CTranslate2)."""

    def __init__(
        self,
        model_size: str = "base",
        device: str = "cpu",
        compute_type: str = "int8",
        language: str = "en",
    ):
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self.language = language
        self._model = None

    async def initialize(self) -> None:
        """Load the Whisper model."""
        logger.info(
            f"Loading faster-whisper model: {self.model_size} "
            f"(device={self.device}, compute_type={self.compute_type})"
        )

        # Load model in a thread to not block the event loop
        loop = asyncio.get_event_loop()
        self._model = await loop.run_in_executor(None, self._load_model)

        logger.info(f"✅ faster-whisper model '{self.model_size}' loaded successfully.")

    def _load_model(self):
        """Load the model (blocking, runs in executor)."""
        from faster_whisper import WhisperModel

        return WhisperModel(
            self.model_size,
            device=self.device,
            compute_type=self.compute_type,
        )

    async def transcribe(self, audio_data: bytes) -> str:
        """Transcribe audio bytes to text.

        Args:
            audio_data: Raw PCM16 audio bytes at 16kHz mono

        Returns:
            Transcribed text
        """
        if self._model is None:
            raise RuntimeError("Whisper model not initialized. Call initialize() first.")

        # Convert bytes to numpy array (PCM16 → float32)
        audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0

        # Run transcription in executor to not block
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, self._transcribe_sync, audio_array)

        return result

    def _transcribe_sync(self, audio_array: np.ndarray) -> str:
        """Synchronous transcription (runs in thread pool)."""
        segments, info = self._model.transcribe(
            audio_array,
            language=self.language,
            beam_size=5,
            vad_filter=True,           # Voice Activity Detection
            vad_parameters=dict(
                min_silence_duration_ms=500,
                speech_pad_ms=200,
            ),
        )

        # Collect all segment texts
        text_parts = []
        for segment in segments:
            text_parts.append(segment.text.strip())

        full_text = " ".join(text_parts).strip()

        if full_text:
            logger.debug(f"Transcribed: '{full_text[:80]}...' ({info.language}, p={info.language_probability:.2f})")

        return full_text

    async def shutdown(self) -> None:
        """Cleanup the model."""
        self._model = None
        logger.info("faster-whisper model unloaded.")

    @property
    def name(self) -> str:
        return f"faster-whisper ({self.model_size})"
