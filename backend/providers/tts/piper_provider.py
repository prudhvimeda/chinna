"""
Piper TTS Provider — Ultra-lightweight fallback TTS.
ONNX-based, works on Raspberry Pi. Perfect as a resilience fallback.
"""

import asyncio
import io
import logging
import base64
import subprocess
import tempfile
from pathlib import Path
from typing import AsyncGenerator

import numpy as np
import soundfile as sf

from providers.base import TTSProvider

logger = logging.getLogger(__name__)


class PiperTTSProvider(TTSProvider):
    """Text-to-speech using Piper (ONNX-based, ultra-lightweight)."""

    def __init__(self, model_path: str = "models/en_US-lessac-medium.onnx"):
        self.model_path = model_path
        self._sample_rate = 22050
        self._available = False

    async def initialize(self) -> None:
        """Check if Piper is available."""
        logger.info(f"Initializing Piper TTS (model: {self.model_path})...")

        # Check if piper-tts is available
        try:
            result = await asyncio.create_subprocess_exec(
                "piper", "--help",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await result.wait()
            self._available = True
            logger.info("✅ Piper TTS ready.")
        except FileNotFoundError:
            logger.warning(
                "Piper CLI not found. Install with: pip install piper-tts"
            )
            # Try Python API fallback
            try:
                import piper
                self._available = True
                logger.info("✅ Piper TTS (Python API) ready.")
            except ImportError:
                logger.error("Piper TTS not available. Install: pip install piper-tts")
                self._available = False

    async def synthesize(self, text: str) -> tuple[bytes, int]:
        """Synthesize text to audio using Piper.

        Args:
            text: Text to convert to speech

        Returns:
            Tuple of (wav_bytes, sample_rate)
        """
        if not self._available:
            raise RuntimeError("Piper TTS not available.")

        loop = asyncio.get_event_loop()
        audio_bytes = await loop.run_in_executor(None, self._synthesize_sync, text)
        return audio_bytes, self._sample_rate

    def _synthesize_sync(self, text: str) -> bytes:
        """Synchronous Piper synthesis."""
        try:
            # Try Python API first
            import piper

            voice = piper.PiperVoice.load(self.model_path)
            buffer = io.BytesIO()
            with sf.SoundFile(
                buffer, mode="w", samplerate=self._sample_rate,
                channels=1, format="WAV", subtype="PCM_16"
            ) as f:
                for audio_bytes in voice.synthesize_stream_raw(text):
                    audio_array = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                    f.write(audio_array)

            buffer.seek(0)
            return buffer.read()

        except (ImportError, Exception) as e:
            logger.debug(f"Piper Python API failed ({e}), falling back to CLI...")
            return self._synthesize_cli(text)

    def _synthesize_cli(self, text: str) -> bytes:
        """Fallback: use Piper CLI."""
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            result = subprocess.run(
                ["piper", "--model", self.model_path, "--output_file", tmp_path],
                input=text,
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode != 0:
                raise RuntimeError(f"Piper CLI error: {result.stderr}")

            with open(tmp_path, "rb") as f:
                return f.read()
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    async def synthesize_stream(self, text: str) -> AsyncGenerator[tuple[bytes, int], None]:
        """Stream synthesis (Piper generates whole audio, so we chunk it)."""
        audio_bytes, sr = await self.synthesize(text)
        # Piper doesn't natively stream, so yield the whole thing
        yield audio_bytes, sr

    async def synthesize_to_base64(self, text: str) -> tuple[str, int]:
        """Synthesize and return base64-encoded audio."""
        audio_bytes, sr = await self.synthesize(text)
        return base64.b64encode(audio_bytes).decode("utf-8"), sr

    async def shutdown(self) -> None:
        """Cleanup."""
        self._available = False
        logger.info("Piper TTS shutdown.")

    @property
    def name(self) -> str:
        return "Piper TTS"

    @property
    def sample_rate(self) -> int:
        return self._sample_rate
