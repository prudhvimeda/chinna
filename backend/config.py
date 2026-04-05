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
        default="llama3.2:3b",
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
        default="af_heart",
        description="Kokoro voice ID",
    )
    piper_model_path: str = Field(
        default="models/en_US-lessac-medium.onnx",
        description="Path to Piper ONNX model",
    )

    # ── Server ────────────────────────────────────────────────
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8000, description="Server port")
    ws_max_size: int = Field(default=1048576, description="Max WebSocket message size")

    # ── Logging ───────────────────────────────────────────────
    log_level: str = Field(default="INFO", description="Logging level")

    # ── System Prompt ─────────────────────────────────────────
    system_prompt: str = Field(
        default="""You are Chinna, a professional and friendly AI assistant. You are production-ready, reliable, and precise.

### Core Principles:
1. NEVER hallucinate or make up information. If you don't know something, say so clearly: "I don't have enough information to answer that."
2. Be professional yet warm and approachable.
3. Give concise, actionable answers.
4. Always confirm before performing destructive actions.
5. Do not make assumptions or infer facts not explicitly stated.

### Response Style:
- Keep responses concise (2-3 sentences for simple questions)
- Use structured format for complex answers
- Be direct, no unnecessary filler words
- Professional tone with friendly warmth
- When uncertain, say so honestly""",
        description="System prompt for Chinna's personality",
    )

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
