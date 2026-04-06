"""
Kokoro TTS Provider — Local text-to-speech synthesis.
Kokoro-82M: Only 82M parameters, faster-than-realtime on CPU.
Apache 2.0 license.
"""

import asyncio
import io
import logging
import base64
from typing import AsyncGenerator, Optional

import numpy as np
import soundfile as sf

from providers.base import TTSProvider

logger = logging.getLogger(__name__)


class KokoroTTSProvider(TTSProvider):
    """Text-to-speech using Kokoro-82M (local, fast, Apache 2.0)."""

    def __init__(self, voice: str = "af_heart"):
        self.voice = voice
        self._pipeline = None
        self._sample_rate = 24000

    async def initialize(self) -> None:
        """Load the Kokoro TTS model."""
        logger.info(f"Loading Kokoro TTS model with voice '{self.voice}'...")

        loop = asyncio.get_event_loop()
        self._pipeline = await loop.run_in_executor(None, self._load_model)

        logger.info(f"✅ Kokoro TTS loaded successfully (voice: {self.voice})")

    def _load_model(self):
        """Load model (blocking, runs in executor)."""
        try:
            from kokoro import KPipeline

            pipeline = KPipeline(lang_code="a")  # 'a' for American English
            return pipeline
        except ImportError:
            logger.error(
                "Kokoro not installed. Install with: pip install kokoro"
            )
            raise
        except Exception as e:
            logger.error(f"Failed to load Kokoro: {e}")
            raise

    async def synthesize(self, text: str) -> tuple[bytes, int]:
        """Synthesize text to audio bytes.

        Args:
            text: Text to speak

        Returns:
            Tuple of (wav_bytes, sample_rate)
        """
        if self._pipeline is None:
            raise RuntimeError("Kokoro not initialized. Call initialize() first.")

        loop = asyncio.get_event_loop()
        audio_bytes = await loop.run_in_executor(None, self._synthesize_sync, text)
        return audio_bytes, self._sample_rate

    def _synthesize_sync(self, text: str) -> bytes:
        """Synchronous synthesis (runs in thread pool)."""
        all_audio = []

        for result in self._pipeline(text, voice=self.voice):
            if result.audio is not None:
                all_audio.append(result.audio.numpy() if hasattr(result.audio, 'numpy') else np.array(result.audio))

        if not all_audio:
            logger.warning("Kokoro produced no audio output.")
            return b""

        # Concatenate all audio chunks
        full_audio = np.concatenate(all_audio)

        # Convert to WAV bytes
        buffer = io.BytesIO()
        sf.write(buffer, full_audio, self._sample_rate, format="WAV", subtype="PCM_16")
        buffer.seek(0)
        return buffer.read()

    async def synthesize_stream(self, text: str) -> AsyncGenerator[tuple[bytes, int], None]:
        """Stream synthesized audio chunks.

        Yields:
            Tuples of (wav_chunk_bytes, sample_rate)
        """
        if self._pipeline is None:
            raise RuntimeError("Kokoro not initialized. Call initialize() first.")

        loop = asyncio.get_event_loop()

        # Use a queue to stream chunks from the sync generator
        chunk_queue = asyncio.Queue()
        finished = asyncio.Event()

        def _generate_chunks():
            """Run synthesis and put chunks in queue."""
            try:
                for result in self._pipeline(text, voice=self.voice):
                    if result.audio is not None:
                        audio = result.audio.numpy() if hasattr(result.audio, 'numpy') else np.array(result.audio)
                        # Convert to WAV bytes
                        buffer = io.BytesIO()
                        sf.write(buffer, audio, self._sample_rate, format="WAV", subtype="PCM_16")
                        buffer.seek(0)
                        chunk_bytes = buffer.read()
                        loop.call_soon_threadsafe(
                            chunk_queue.put_nowait, chunk_bytes
                        )
            except Exception as e:
                logger.error(f"Kokoro streaming error: {e}")
            finally:
                loop.call_soon_threadsafe(finished.set)

        # Start synthesis in background thread
        loop.run_in_executor(None, _generate_chunks)

        # Yield chunks as they become available
        while not finished.is_set() or not chunk_queue.empty():
            try:
                chunk = await asyncio.wait_for(chunk_queue.get(), timeout=0.1)
                yield chunk, self._sample_rate
            except asyncio.TimeoutError:
                continue

    async def synthesize_to_base64(self, text: str) -> tuple[str, int]:
        """Synthesize and return base64-encoded audio.

        Returns:
            Tuple of (base64_audio_string, sample_rate)
        """
        audio_bytes, sample_rate = await self.synthesize(text)
        return base64.b64encode(audio_bytes).decode("utf-8"), sample_rate

    async def shutdown(self) -> None:
        """Cleanup."""
        self._pipeline = None
        logger.info("Kokoro TTS unloaded.")

    @property
    def name(self) -> str:
        return f"Kokoro-82M ({self.voice})"

    @property
    def sample_rate(self) -> int:
        return self._sample_rate
