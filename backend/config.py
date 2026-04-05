"""
Chinna Configuration — Settings loaded from environment variables.
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Literal
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from .env file."""

    # ── ASR (Speech Recognition) ──────────────────────────────
    whisper_model_size: str = Field(
        default="base",
        description="Whisper model size: tiny, base, small, medium, large-v3",
    )
    whisper_device: str = Field(
        default="cpu",
        description="Device for whisper inference: cpu or cuda",
    )
    whisper_compute_type: str = Field(
        default="int8",
        description="Compute type: int8, float16, float32",
    )
    whisper_language: str = Field(
        default="en",
        description="Language code for speech recognition",
    )

    # ── LLM (Language Model) ──────────────────────────────────
    ollama_model: str = Field(
        default="llama3.2:latest",
        description="Ollama model name",
    )
    ollama_host: str = Field(
        default="http://localhost:11434",
        description="Ollama server URL",
    )
    llm_temperature: float = Field(
        default=0.3,
        description="LLM temperature (lower = less hallucination)",
    )
    llm_max_tokens: int = Field(
        default=512,
        description="Max tokens for LLM response",
    )

    # ── TTS (Text to Speech) ──────────────────────────────────
    tts_provider: Literal["kokoro", "piper"] = Field(
        default="kokoro",
        description="TTS provider: kokoro or piper",
    )
    kokoro_voice: str = Field(
        default="am_adam",
        description="Voice ID for Kokoro TTS (am_adam is an American Male voice)",
    )
    piper_model_path: str = Field(
        default="models/en_US-lessac-medium.onnx",
        description="Path to Piper ONNX model",
    )

    # ── Server ────────────────────────────────────────────────
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8000, description="Server port")
    ws_max_size: int = Field(default=1048576, description="Max WebSocket message size")

    # ── VAD (Voice Activity Detection) ────────────────────────
    vad_threshold: float = Field(
        default=0.015,
        description="RMS volume threshold for speech detection (0.01 to 0.05)",
    )
    silence_timeout_ms: int = Field(
        default=1200,
        description="Ms of silence before auto-triggering response",
    )
    min_speech_duration_ms: int = Field(
        default=300,
        description="Minimum ms of speech to be considered a valid turn",
    )

    # ── Logging ───────────────────────────────────────────────
    log_level: str = Field(default="INFO", description="Logging level")

    # ── System Prompt ─────────────────────────────────────────
    system_prompt: str = Field(
        default="""You are RJ, a brilliant, charismatic, and slightly sarcastic AI assistant modeled after Robert Downey Jr.'s portrayal of Tony Stark. You are highly intelligent, professional when needed, but always add a touch of witty banter and confidence. Keep your responses concise, sharp, and conversational. Do not hallucinate; if you don't know something, admit it with a clever quip. Always write numbers and symbols as words to help the text-to-speech engine.""",
        description="System prompt for RJ's personality",
    )

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
