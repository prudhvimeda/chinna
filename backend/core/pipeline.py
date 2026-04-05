"""
Chinna Voice Pipeline — Main streaming orchestrator.

Connects: Audio → ASR → LLM → TTS → Audio
Manages the full conversation turn lifecycle.
"""

import asyncio
import base64
import logging
from typing import Optional, Callable, Awaitable

from config import Settings
from core.events import Event, PipelineStatus, LatencyMetrics
from core.session import Session
from monitoring.latency import LatencyTracker, LatencyHistory
from providers.base import ASRProvider, LLMProvider, TTSProvider
from providers.asr.whisper_provider import WhisperASRProvider
from providers.llm.ollama_provider import OllamaLLMProvider
from providers.tts.kokoro_provider import KokoroTTSProvider

logger = logging.getLogger(__name__)


class VoicePipeline:
    """Main streaming voice pipeline orchestrator.

    Connects ASR → LLM → TTS in a real-time streaming chain.
    Handles interruption, error recovery, and latency tracking.
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.asr: ASRProvider = WhisperASRProvider(
            model_size=settings.whisper_model_size,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
            language=settings.whisper_language,
        )
        self.llm: LLMProvider = OllamaLLMProvider(
            model=settings.ollama_model,
            host=settings.ollama_host,
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
        )
        self.tts: TTSProvider = KokoroTTSProvider(
            voice=settings.kokoro_voice,
        )

        self.latency_tracker = LatencyTracker()
        self.latency_history = LatencyHistory()
        self._status = PipelineStatus.IDLE
        self._interrupted = False

    async def initialize(self) -> None:
        """Initialize all providers."""
        logger.info("🚀 Initializing RJ voice pipeline...")

        # Initialize providers concurrently
        results = await asyncio.gather(
            self.asr.initialize(),
            self.llm.initialize(),
            self.tts.initialize(),
            return_exceptions=True,
        )

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                provider_name = ["ASR", "LLM", "TTS"][i]
                logger.error(f"Failed to initialize {provider_name}: {result}")
                raise result

        logger.info(
            f"✅ Pipeline ready!\n"
            f"   ASR: {self.asr.name}\n"
            f"   LLM: {self.llm.name}\n"
            f"   TTS: {self.tts.name}"
        )

    async def process_turn(
        self,
        audio_data: bytes,
        session: Session,
        send_event: Callable[[Event], Awaitable[None]],
    ) -> None:
        """Process a full conversation turn: Audio → ASR → LLM → TTS → Audio.

        Args:
            audio_data: Raw audio bytes from microphone (PCM16, 16kHz, mono)
            session: Current conversation session
            send_event: Callback to send events to the client
        """
        self._interrupted = False
        turn_id = session.new_turn()

        # Start latency tracking
        self.latency_tracker.start_turn()

        try:
            # ── Step 1: ASR (Speech → Text) ───────────────────
            await send_event(Event.status(PipelineStatus.TRANSCRIBING, session.session_id))
            self._status = PipelineStatus.TRANSCRIBING

            self.latency_tracker.start_asr()
            transcript = await self.asr.transcribe(audio_data)
            self.latency_tracker.end_asr()

            if not transcript or not transcript.strip():
                logger.debug("Empty transcript, skipping turn.")
                await send_event(Event.status(PipelineStatus.IDLE, session.session_id))
                return

            # Send transcript to client
            await send_event(Event.transcript(transcript, is_final=True, session_id=session.session_id))
            session.add_user_message(transcript)

            logger.info(f"🎤 User: {transcript}")

            # Check for interruption
            if self._interrupted:
                return

            # ── Step 2: LLM (Text → Response) ────────────────
            await send_event(Event.status(PipelineStatus.THINKING, session.session_id))
            self._status = PipelineStatus.THINKING

            self.latency_tracker.start_llm()
            full_response = []
            first_token = True

            async for token in self.llm.generate_stream(
                messages=session.get_conversation_history(),
                system_prompt=self.settings.system_prompt,
            ):
                if self._interrupted:
                    break

                if first_token:
                    self.latency_tracker.mark_llm_first_token()
                    first_token = False

                full_response.append(token)
                await send_event(Event.llm_token(token, session_id=session.session_id))

            self.latency_tracker.end_llm()

            response_text = "".join(full_response).strip()
            if not response_text:
                return

            await send_event(Event.llm_complete(response_text, session_id=session.session_id))
            session.add_assistant_message(response_text)

            logger.info(f"🤖 RJ: {response_text[:100]}...")

            # Check for interruption
            if self._interrupted:
                return

            # ── Step 3: TTS (Response → Audio) ────────────────
            await send_event(Event.status(PipelineStatus.SPEAKING, session.session_id))
            self._status = PipelineStatus.SPEAKING

            self.latency_tracker.start_tts()
            first_byte = True

            async for audio_chunk, sample_rate in self.tts.synthesize_stream(response_text):
                if self._interrupted:
                    break

                if first_byte:
                    self.latency_tracker.mark_tts_first_byte()
                    first_byte = False

                # Base64 encode audio for WebSocket transport
                audio_b64 = base64.b64encode(audio_chunk).decode("utf-8")
                await send_event(Event.tts_audio(audio_b64, sample_rate, session_id=session.session_id))

            self.latency_tracker.end_tts()

            # Send TTS complete
            await send_event(Event(
                type="tts_complete",
                session_id=session.session_id,
            ))

            # ── Step 4: Report Latency ────────────────────────
            metrics = self.latency_tracker.get_metrics()
            self.latency_history.add(metrics)
            await send_event(Event.latency(metrics, session_id=session.session_id))

        except Exception as e:
            logger.error(f"Pipeline error: {e}", exc_info=True)
            await send_event(Event.error(
                message=f"Pipeline error: {str(e)}",
                code="PIPELINE_ERROR",
                session_id=session.session_id,
            ))

        finally:
            self._status = PipelineStatus.IDLE
            await send_event(Event.status(PipelineStatus.IDLE, session.session_id))

    def interrupt(self) -> None:
        """Interrupt the current turn (user barge-in)."""
        self._interrupted = True
        logger.info("⚡ Turn interrupted by user.")

    @property
    def status(self) -> PipelineStatus:
        return self._status

    async def shutdown(self) -> None:
        """Shutdown all providers."""
        logger.info("Shutting down pipeline...")
        await asyncio.gather(
            self.asr.shutdown(),
            self.llm.shutdown(),
            self.tts.shutdown(),
            return_exceptions=True,
        )
        logger.info("Pipeline shutdown complete.")
