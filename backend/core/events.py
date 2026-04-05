"""
Chinna Event System — Structured WebSocket protocol messages.

All communication between frontend and backend follows this event schema.
"""

from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import uuid


class EventType(str, Enum):
    """All event types in the WebSocket protocol."""

    # ── Client → Server ──────────────────────────────────────
    AUDIO_CHUNK = "audio_chunk"          # Raw audio data from microphone
    START_LISTENING = "start_listening"   # Client starts recording
    STOP_LISTENING = "stop_listening"     # Client stops recording
    INTERRUPT = "interrupt"              # User interrupts assistant
    CONFIG_UPDATE = "config_update"      # Client updates settings

    # ── Server → Client ──────────────────────────────────────
    TRANSCRIPT_PARTIAL = "transcript_partial"  # Interim ASR result
    TRANSCRIPT_FINAL = "transcript_final"      # Final ASR result
    LLM_TOKEN = "llm_token"                    # Streaming LLM token
    LLM_COMPLETE = "llm_complete"              # Full LLM response
    TTS_AUDIO = "tts_audio"                    # Synthesized audio chunk
    TTS_COMPLETE = "tts_complete"              # TTS finished

    # ── Bidirectional ─────────────────────────────────────────
    ERROR = "error"                      # Error event
    LATENCY_REPORT = "latency_report"    # Latency metrics
    STATUS = "status"                    # Pipeline status update
    PING = "ping"                        # Keepalive
    PONG = "pong"                        # Keepalive response


class PipelineStatus(str, Enum):
    """Pipeline state machine."""
    IDLE = "idle"
    LISTENING = "listening"
    TRANSCRIBING = "transcribing"
    THINKING = "thinking"
    SPEAKING = "speaking"
    ERROR = "error"


class LatencyMetrics(BaseModel):
    """Per-turn latency breakdown."""
    turn_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    asr_ms: float = 0.0               # Audio → transcript
    llm_ttft_ms: float = 0.0          # Time to first token
    llm_total_ms: float = 0.0         # Full LLM generation
    tts_ttfb_ms: float = 0.0          # Time to first audio byte
    tts_total_ms: float = 0.0         # Full TTS synthesis
    overhead_ms: float = 0.0          # Pipeline overhead
    total_ms: float = 0.0             # End-to-end latency
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class Event(BaseModel):
    """Base event for WebSocket communication."""
    type: EventType
    data: Any = None
    session_id: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_json(self) -> dict:
        """Serialize to JSON-safe dict."""
        return self.model_dump(mode="json")

    @classmethod
    def status(cls, status: PipelineStatus, session_id: str = None) -> "Event":
        """Create a status event."""
        return cls(
            type=EventType.STATUS,
            data={"status": status.value},
            session_id=session_id,
        )

    @classmethod
    def error(cls, message: str, code: str = "UNKNOWN", session_id: str = None) -> "Event":
        """Create an error event."""
        return cls(
            type=EventType.ERROR,
            data={"message": message, "code": code},
            session_id=session_id,
        )

    @classmethod
    def transcript(cls, text: str, is_final: bool = False, session_id: str = None) -> "Event":
        """Create a transcript event."""
        return cls(
            type=EventType.TRANSCRIPT_FINAL if is_final else EventType.TRANSCRIPT_PARTIAL,
            data={"text": text, "is_final": is_final},
            session_id=session_id,
        )

    @classmethod
    def llm_token(cls, token: str, session_id: str = None) -> "Event":
        """Create an LLM streaming token event."""
        return cls(
            type=EventType.LLM_TOKEN,
            data={"token": token},
            session_id=session_id,
        )

    @classmethod
    def llm_complete(cls, text: str, session_id: str = None) -> "Event":
        """Create an LLM complete event."""
        return cls(
            type=EventType.LLM_COMPLETE,
            data={"text": text},
            session_id=session_id,
        )

    @classmethod
    def tts_audio(cls, audio_base64: str, sample_rate: int = 24000, session_id: str = None) -> "Event":
        """Create a TTS audio chunk event."""
        return cls(
            type=EventType.TTS_AUDIO,
            data={"audio": audio_base64, "sample_rate": sample_rate},
            session_id=session_id,
        )

    @classmethod
    def latency(cls, metrics: LatencyMetrics, session_id: str = None) -> "Event":
        """Create a latency report event."""
        return cls(
            type=EventType.LATENCY_REPORT,
            data=metrics.model_dump(),
            session_id=session_id,
        )
