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

        # Voice Activity Detection (VAD) state
        audio_buffer = bytearray()
        is_speech_active = False
        last_speech_time = 0
        silence_start_time = 0
        
        # Continuous mode flag (can be toggled by client)
        auto_mode = False 

        try:
            while True:
                # Receive message
                message = await websocket.receive()

                if "text" in message:
                    # Update auto_mode if sent in text, or handle other text events
                    data = json.loads(message["text"])
                    if data.get("type") == "set_auto_mode":
                        auto_mode = data.get("enabled", False)
                        logger.info(f"Auto-Voice mode: {'ENABLED' if auto_mode else 'DISABLED'}")
                        continue
                        
                    await self._handle_text_message(
                        websocket, message["text"], session, audio_buffer
                    )
                elif "bytes" in message:
                    chunk = message["bytes"]
                    audio_buffer.extend(chunk)
                    
                    if auto_mode and self.pipeline.status == PipelineStatus.IDLE:
                        # ── Real-time VAD Logic ──────────────────────
                        # Convert bytes to PCM16 numpy array to calculate volume
                        audio_np = np.frombuffer(chunk, dtype=np.int16).astype(np.float32) / 32768.0
                        rms = np.sqrt(np.mean(audio_np**2)) if len(audio_np) > 0 else 0
                        
                        current_time = time.time()
                        
                        if rms > self.pipeline.settings.vad_threshold:
                            if not is_speech_active:
                                logger.debug("👄 Speech detected...")
                                is_speech_active = True
                                await self._send_event(websocket, Event.status(PipelineStatus.LISTENING, session.session_id))
                            
                            last_speech_time = current_time
                            silence_start_time = 0
                        else:
                            if is_speech_active:
                                if silence_start_time == 0:
                                    silence_start_time = current_time
                                
                                silence_duration = (current_time - silence_start_time) * 1000
                                if silence_duration >= self.pipeline.settings.silence_timeout_ms:
                                    # ── AUTO TRIGGER ─────────────────────
                                    speech_duration = (silence_start_time - last_speech_time) * 1000
                                    
                                    if speech_duration >= self.pipeline.settings.min_speech_duration_ms:
                                        logger.info(f"⏹️ Silence detected ({int(silence_duration)}ms). Triggering RJ...")
                                        
                                        audio_data = bytes(audio_buffer)
                                        audio_buffer.clear()
                                        is_speech_active = False
                                        silence_start_time = 0
                                        
                                        # Process turn in background to not block WS loop
                                        asyncio.create_task(self.pipeline.process_turn(
                                            audio_data=audio_data,
                                            session=session,
                                            send_event=lambda event: self._send_event(websocket, event),
                                        ))
                                    else:
                                        # Too short, probably a noise pop
                                        logger.debug(f"🔇 Speech too short ({int(speech_duration)}ms), resetting.")
                                        is_speech_active = False
                                        silence_start_time = 0
                                        audio_buffer.clear()

                        # ── Max Speech Duration Fail-safe ────────────
                        if is_speech_active and (current_time - last_speech_time) > 30:
                            logger.warning("🕒 Max speech duration (30s) reached. Forcing trigger.")
                            audio_data = bytes(audio_buffer)
                            audio_buffer.clear()
                            is_speech_active = False
                            silence_start_time = 0
                            asyncio.create_task(self.pipeline.process_turn(
                                audio_data=audio_data,
                                session=session,
                                send_event=lambda event: self._send_event(websocket, event),
                            ))

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
