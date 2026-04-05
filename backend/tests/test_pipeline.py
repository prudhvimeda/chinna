"""
Basic tests for Chinna pipeline components.
"""

import pytest
from core.events import Event, EventType, PipelineStatus, LatencyMetrics
from core.session import Session, SessionManager
from monitoring.latency import LatencyTracker, LatencyHistory


class TestEvents:
    """Test event creation and serialization."""

    def test_status_event(self):
        event = Event.status(PipelineStatus.LISTENING, "test-session")
        data = event.to_json()
        assert data["type"] == "status"
        assert data["data"]["status"] == "listening"
        assert data["session_id"] == "test-session"

    def test_error_event(self):
        event = Event.error("Something went wrong", "TEST_ERROR")
        data = event.to_json()
        assert data["type"] == "error"
        assert data["data"]["message"] == "Something went wrong"
        assert data["data"]["code"] == "TEST_ERROR"

    def test_transcript_event(self):
        event = Event.transcript("Hello world", is_final=True)
        data = event.to_json()
        assert data["type"] == "transcript_final"
        assert data["data"]["text"] == "Hello world"
        assert data["data"]["is_final"] is True

    def test_llm_token_event(self):
        event = Event.llm_token("Hello")
        data = event.to_json()
        assert data["type"] == "llm_token"
        assert data["data"]["token"] == "Hello"

    def test_latency_metrics(self):
        metrics = LatencyMetrics(
            asr_ms=150.0,
            llm_ttft_ms=200.0,
            llm_total_ms=500.0,
            tts_ttfb_ms=100.0,
            tts_total_ms=300.0,
            total_ms=1000.0,
        )
        assert metrics.asr_ms == 150.0
        assert metrics.total_ms == 1000.0


class TestSession:
    """Test session management."""

    def test_create_session(self):
        session = Session()
        assert session.session_id
        assert session.is_active
        assert len(session.messages) == 0

    def test_add_messages(self):
        session = Session()
        session.add_user_message("Hello")
        session.add_assistant_message("Hi there!")
        assert len(session.messages) == 2
        assert session.messages[0].role == "user"
        assert session.messages[1].role == "assistant"

    def test_conversation_history(self):
        session = Session()
        session.add_user_message("Hello")
        session.add_assistant_message("Hi!")
        history = session.get_conversation_history()
        assert len(history) == 2
        assert history[0] == {"role": "user", "content": "Hello"}
        assert history[1] == {"role": "assistant", "content": "Hi!"}

    def test_clear_session(self):
        session = Session()
        session.add_user_message("Hello")
        session.clear()
        assert len(session.messages) == 0


class TestSessionManager:
    """Test session manager."""

    def test_create_and_get(self):
        manager = SessionManager()
        session = manager.create_session()
        retrieved = manager.get_session(session.session_id)
        assert retrieved is session

    def test_remove_session(self):
        manager = SessionManager()
        session = manager.create_session()
        manager.remove_session(session.session_id)
        assert manager.get_session(session.session_id) is None
        assert manager.active_count == 0


class TestLatencyTracker:
    """Test latency tracking."""

    def test_basic_tracking(self):
        tracker = LatencyTracker()
        tracker.start_turn()

        import time
        tracker.start_asr()
        time.sleep(0.01)  # 10ms
        tracker.end_asr()

        tracker.start_llm()
        time.sleep(0.01)
        tracker.mark_llm_first_token()
        time.sleep(0.01)
        tracker.end_llm()

        tracker.start_tts()
        time.sleep(0.01)
        tracker.mark_tts_first_byte()
        time.sleep(0.01)
        tracker.end_tts()

        metrics = tracker.get_metrics()
        assert metrics.asr_ms > 0
        assert metrics.llm_ttft_ms > 0
        assert metrics.tts_ttfb_ms > 0
        assert metrics.total_ms > 0


class TestLatencyHistory:
    """Test latency history."""

    def test_averages(self):
        history = LatencyHistory()
        history.add(LatencyMetrics(asr_ms=100, total_ms=500))
        history.add(LatencyMetrics(asr_ms=200, total_ms=600))
        avgs = history.get_averages()
        assert avgs["avg_asr_ms"] == 150.0
        assert avgs["avg_total_ms"] == 550.0
