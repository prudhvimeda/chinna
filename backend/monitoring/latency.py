"""
Chinna Latency Tracker — Per-component performance monitoring.

Tracks: ASR latency, LLM TTFT, LLM total, TTS TTFB, TTS total, overhead.
"""

import time
import logging
from dataclasses import dataclass, field
from typing import Optional
from collections import deque

from core.events import LatencyMetrics

logger = logging.getLogger(__name__)


class LatencyTracker:
    """Tracks latency for a single conversation turn.

    Usage:
        tracker = LatencyTracker()
        tracker.start_turn()

        tracker.start_asr()
        # ... do ASR ...
        tracker.end_asr()

        tracker.start_llm()
        tracker.mark_llm_first_token()
        # ... stream tokens ...
        tracker.end_llm()

        tracker.start_tts()
        tracker.mark_tts_first_byte()
        # ... generate audio ...
        tracker.end_tts()

        metrics = tracker.get_metrics()
    """

    def __init__(self):
        self._turn_start: float = 0
        self._asr_start: float = 0
        self._asr_end: float = 0
        self._llm_start: float = 0
        self._llm_first_token: float = 0
        self._llm_end: float = 0
        self._tts_start: float = 0
        self._tts_first_byte: float = 0
        self._tts_end: float = 0

    def start_turn(self) -> None:
        """Mark the beginning of a conversation turn."""
        self._turn_start = time.perf_counter()
        self._reset()

    def _reset(self) -> None:
        """Reset all markers except turn start."""
        self._asr_start = 0
        self._asr_end = 0
        self._llm_start = 0
        self._llm_first_token = 0
        self._llm_end = 0
        self._tts_start = 0
        self._tts_first_byte = 0
        self._tts_end = 0

    # ── ASR Tracking ──────────────────────────────────────────

    def start_asr(self) -> None:
        self._asr_start = time.perf_counter()

    def end_asr(self) -> None:
        self._asr_end = time.perf_counter()

    # ── LLM Tracking ──────────────────────────────────────────

    def start_llm(self) -> None:
        self._llm_start = time.perf_counter()

    def mark_llm_first_token(self) -> None:
        if self._llm_first_token == 0:
            self._llm_first_token = time.perf_counter()

    def end_llm(self) -> None:
        self._llm_end = time.perf_counter()

    # ── TTS Tracking ──────────────────────────────────────────

    def start_tts(self) -> None:
        self._tts_start = time.perf_counter()

    def mark_tts_first_byte(self) -> None:
        if self._tts_first_byte == 0:
            self._tts_first_byte = time.perf_counter()

    def end_tts(self) -> None:
        self._tts_end = time.perf_counter()

    # ── Metrics ───────────────────────────────────────────────

    def _ms(self, start: float, end: float) -> float:
        """Convert perf_counter diff to milliseconds."""
        if start == 0 or end == 0:
            return 0.0
        return round((end - start) * 1000, 2)

    def get_metrics(self) -> LatencyMetrics:
        """Calculate and return all latency metrics."""
        asr_ms = self._ms(self._asr_start, self._asr_end)
        llm_ttft_ms = self._ms(self._llm_start, self._llm_first_token)
        llm_total_ms = self._ms(self._llm_start, self._llm_end)
        tts_ttfb_ms = self._ms(self._tts_start, self._tts_first_byte)
        tts_total_ms = self._ms(self._tts_start, self._tts_end)

        total_ms = self._ms(self._turn_start, self._tts_end if self._tts_end else time.perf_counter())

        # Overhead = total - (ASR + LLM + TTS)
        overhead_ms = round(total_ms - asr_ms - llm_total_ms - tts_total_ms, 2)
        overhead_ms = max(0, overhead_ms)

        metrics = LatencyMetrics(
            asr_ms=asr_ms,
            llm_ttft_ms=llm_ttft_ms,
            llm_total_ms=llm_total_ms,
            tts_ttfb_ms=tts_ttfb_ms,
            tts_total_ms=tts_total_ms,
            overhead_ms=overhead_ms,
            total_ms=total_ms,
        )

        logger.info(
            f"⏱️  Latency: ASR={asr_ms}ms | LLM TTFT={llm_ttft_ms}ms | "
            f"LLM Total={llm_total_ms}ms | TTS TTFB={tts_ttfb_ms}ms | "
            f"TTS Total={tts_total_ms}ms | Overhead={overhead_ms}ms | "
            f"Total={total_ms}ms"
        )

        return metrics


class LatencyHistory:
    """Keeps a rolling history of latency metrics for analysis."""

    def __init__(self, max_size: int = 100):
        self._history: deque[LatencyMetrics] = deque(maxlen=max_size)

    def add(self, metrics: LatencyMetrics) -> None:
        self._history.append(metrics)

    def get_averages(self) -> dict:
        """Calculate average latencies across all recorded turns."""
        if not self._history:
            return {}

        n = len(self._history)
        return {
            "avg_asr_ms": round(sum(m.asr_ms for m in self._history) / n, 2),
            "avg_llm_ttft_ms": round(sum(m.llm_ttft_ms for m in self._history) / n, 2),
            "avg_llm_total_ms": round(sum(m.llm_total_ms for m in self._history) / n, 2),
            "avg_tts_ttfb_ms": round(sum(m.tts_ttfb_ms for m in self._history) / n, 2),
            "avg_tts_total_ms": round(sum(m.tts_total_ms for m in self._history) / n, 2),
            "avg_total_ms": round(sum(m.total_ms for m in self._history) / n, 2),
            "turns_recorded": n,
        }

    def get_p95(self) -> dict:
        """Calculate P95 latencies."""
        if len(self._history) < 5:
            return {}

        import statistics

        def p95(values):
            sorted_v = sorted(values)
            idx = int(len(sorted_v) * 0.95)
            return round(sorted_v[min(idx, len(sorted_v) - 1)], 2)

        return {
            "p95_asr_ms": p95([m.asr_ms for m in self._history]),
            "p95_llm_ttft_ms": p95([m.llm_ttft_ms for m in self._history]),
            "p95_total_ms": p95([m.total_ms for m in self._history]),
        }
