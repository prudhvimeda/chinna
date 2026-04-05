"""
Chinna WebSocket Handler — Manages WebSocket connections and message routing.
"""

import asyncio
import json
import logging
import base64
import numpy as np
import time
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect

from config import Settings
from core.events import Event, EventType, PipelineStatus
from core.pipeline import VoicePipeline
from core.session import Session, SessionManager

logger = logging.getLogger(__name__)


class WebSocketHandler:
    """Handles WebSocket connections for voice communication."""

    def __init__(self, pipeline: VoicePipeline, session_manager: SessionManager):
        self.pipeline = pipeline
        self.session_manager = session_manager

    async def handle_connection(self, websocket: WebSocket) -> None:
        """Handle a WebSocket connection lifecycle."""
        await websocket.accept()
        session = self.session_manager.create_session()

        logger.info(f"🔗 Client connected (session: {session.session_id[:8]})")

        # Send initial status
        await self._send_event(websocket, Event.status(PipelineStatus.IDLE, session.session_id))

        # Audio buffer for accumulating chunks
        audio_buffer = bytearray()
        is_recording = False

        try:
            while True:
                # Receive message
                message = await websocket.receive()

                if "text" in message:
                    await self._handle_text_message(
                        websocket, message["text"], session, audio_buffer
                    )
                elif "bytes" in message:
                    # Collect audio data
                    audio_buffer.extend(message["bytes"])

        except WebSocketDisconnect:
            logger.info(f"🔌 Client disconnected (session: {session.session_id[:8]})")
        except Exception as e:
            logger.error(f"WebSocket error: {e}", exc_info=True)
            try:
                await self._send_event(
                    websocket,
                    Event.error(str(e), "WS_ERROR", session.session_id),
                )
            except Exception:
                pass
        finally:
            self.session_manager.remove_session(session.session_id)

    async def _handle_text_message(
        self,
        websocket: WebSocket,
        raw_message: str,
        session: Session,
        audio_buffer: bytearray,
    ) -> None:
        """Process a JSON text message from the client."""
        try:
            data = json.loads(raw_message)
            event_type = data.get("type", "")

            if event_type == EventType.START_LISTENING.value:
                audio_buffer.clear()
                logger.debug("Client started recording.")
                await self._send_event(
                    websocket,
                    Event.status(PipelineStatus.LISTENING, session.session_id),
                )

            elif event_type == EventType.STOP_LISTENING.value:
                logger.debug(f"Client stopped recording. Buffer size: {len(audio_buffer)} bytes")

                if len(audio_buffer) > 0:
                    # Process the recorded audio through the pipeline
                    audio_data = bytes(audio_buffer)
                    audio_buffer.clear()

                    await self.pipeline.process_turn(
                        audio_data=audio_data,
                        session=session,
                        send_event=lambda event: self._send_event(websocket, event),
                    )
                else:
                    logger.debug("Empty audio buffer, skipping.")
                    await self._send_event(
                        websocket,
                        Event.status(PipelineStatus.IDLE, session.session_id),
                    )

            elif event_type == EventType.AUDIO_CHUNK.value:
                # Handle base64-encoded audio chunks
                audio_b64 = data.get("data", {}).get("audio", "")
                if audio_b64:
                    audio_bytes = base64.b64decode(audio_b64)
                    audio_buffer.extend(audio_bytes)

            elif event_type == EventType.INTERRUPT.value:
                self.pipeline.interrupt()
                audio_buffer.clear()
                await self._send_event(
                    websocket,
                    Event.status(PipelineStatus.IDLE, session.session_id),
                )

            elif event_type == EventType.PING.value:
                await self._send_event(
                    websocket,
                    Event(type=EventType.PONG, session_id=session.session_id),
                )

            else:
                logger.warning(f"Unknown event type: {event_type}")

        except json.JSONDecodeError:
            logger.error(f"Invalid JSON message: {raw_message[:100]}")
        except Exception as e:
            logger.error(f"Error handling message: {e}", exc_info=True)
            await self._send_event(
                websocket,
                Event.error(str(e), "HANDLER_ERROR", session.session_id),
            )

    async def _send_event(self, websocket: WebSocket, event: Event) -> None:
        """Send an event to the client as JSON."""
        try:
            await websocket.send_json(event.to_json())
        except Exception as e:
            logger.error(f"Failed to send event: {e}")
