"""
Chinna Session Management — Conversation history and state per client.
"""

import uuid
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class Message:
    """A single message in the conversation."""
    role: str        # "user" or "assistant"
    content: str
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class Session:
    """A conversation session with a client."""
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    messages: list[Message] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    is_active: bool = True
    current_turn_id: Optional[str] = None

    def add_user_message(self, text: str) -> None:
        """Add a user message to history."""
        self.messages.append(Message(role="user", content=text))
        logger.debug(f"[{self.session_id[:8]}] User: {text[:80]}...")

    def add_assistant_message(self, text: str) -> None:
        """Add an assistant message to history."""
        self.messages.append(Message(role="assistant", content=text))
        logger.debug(f"[{self.session_id[:8]}] Chinna: {text[:80]}...")

    def get_conversation_history(self, max_turns: int = 20) -> list[dict]:
        """Get conversation history in LLM-compatible format."""
        recent = self.messages[-max_turns * 2:] if len(self.messages) > max_turns * 2 else self.messages
        return [{"role": m.role, "content": m.content} for m in recent]

    def clear(self) -> None:
        """Clear conversation history."""
        self.messages.clear()
        logger.info(f"[{self.session_id[:8]}] Session cleared.")

    def new_turn(self) -> str:
        """Start a new conversation turn, returns turn_id."""
        self.current_turn_id = str(uuid.uuid4())[:8]
        return self.current_turn_id


class SessionManager:
    """Manages multiple concurrent sessions."""

    def __init__(self):
        self._sessions: dict[str, Session] = {}

    def create_session(self) -> Session:
        """Create a new session."""
        session = Session()
        self._sessions[session.session_id] = session
        logger.info(f"Session created: {session.session_id[:8]}")
        return session

    def get_session(self, session_id: str) -> Optional[Session]:
        """Get an existing session."""
        return self._sessions.get(session_id)

    def remove_session(self, session_id: str) -> None:
        """Remove a session."""
        if session_id in self._sessions:
            self._sessions[session_id].is_active = False
            del self._sessions[session_id]
            logger.info(f"Session removed: {session_id[:8]}")

    @property
    def active_count(self) -> int:
        """Number of active sessions."""
        return len(self._sessions)
