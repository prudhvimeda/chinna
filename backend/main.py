"""
Chinna AI Voice Assistant — FastAPI Backend Entry Point.

Start with: uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from core.pipeline import VoicePipeline
from core.session import SessionManager
from websocket.handler import WebSocketHandler

# ── Logging Setup ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-8s │ %(name)s │ %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("chinna")

# ── App State ─────────────────────────────────────────────────
settings = get_settings()
session_manager = SessionManager()
pipeline = VoicePipeline(settings)
ws_handler = WebSocketHandler(pipeline, session_manager)


# ── Lifecycle ─────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    logger.info("=" * 60)
    logger.info("  🤖 Chinna AI Voice Assistant")
    logger.info("  Starting up...")
    logger.info("=" * 60)

    try:
        await pipeline.initialize()
        logger.info("🟢 Chinna is ready to listen!")
    except Exception as e:
        logger.error(f"🔴 Failed to initialize: {e}")
        logger.error("   Make sure Ollama is running: 'ollama serve'")
        raise

    yield

    logger.info("Shutting down Chinna...")
    await pipeline.shutdown()
    logger.info("👋 Goodbye!")


# ── FastAPI App ───────────────────────────────────────────────
app = FastAPI(
    title="Chinna AI Voice Assistant",
    description="A production-ready, fully open-source voice assistant",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Endpoints ─────────────────────────────────────────────────

@app.get("/")
async def root():
    """API info."""
    return {
        "name": "Chinna AI Voice Assistant",
        "version": "1.0.0",
        "status": "running",
        "pipeline": {
            "asr": pipeline.asr.name,
            "llm": pipeline.llm.name,
            "tts": pipeline.tts.name,
        },
        "active_sessions": session_manager.active_count,
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "pipeline_status": pipeline.status.value,
        "active_sessions": session_manager.active_count,
    }


@app.get("/latency")
async def latency_stats():
    """Get latency statistics."""
    return {
        "averages": pipeline.latency_history.get_averages(),
        "p95": pipeline.latency_history.get_p95(),
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for voice communication."""
    await ws_handler.handle_connection(websocket)
