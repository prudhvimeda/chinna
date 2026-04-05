'use client';

import React from 'react';
import { LatencyMetrics } from '@/lib/types';
import { LATENCY_GOOD, LATENCY_WARN, LATENCY_BAD } from '@/lib/constants';

interface LatencyDashboardProps {
  metrics: LatencyMetrics | null;
  history: LatencyMetrics[];
}

export default function LatencyDashboard({ metrics, history }: LatencyDashboardProps) {
  if (!metrics) {
    return (
      <div className="latency-dashboard" id="latency-dashboard">
        <h3 className="latency-title">⏱️ Latency</h3>
        <p className="latency-empty">No data yet — have a conversation first</p>
      </div>
    );
  }

  const getLatencyColor = (ms: number) => {
    if (ms <= LATENCY_GOOD) return 'var(--color-success)';
    if (ms <= LATENCY_WARN) return 'var(--color-warning)';
    return 'var(--color-error)';
  };

  const getBarWidth = (ms: number, maxMs: number = 1000) => {
    return Math.min((ms / maxMs) * 100, 100);
  };

  const components = [
    { label: 'ASR', value: metrics.asr_ms, desc: 'Speech → Text' },
    { label: 'LLM TTFT', value: metrics.llm_ttft_ms, desc: 'First Token' },
    { label: 'LLM Total', value: metrics.llm_total_ms, desc: 'Full Response' },
    { label: 'TTS TTFB', value: metrics.tts_ttfb_ms, desc: 'First Audio' },
    { label: 'TTS Total', value: metrics.tts_total_ms, desc: 'Full Audio' },
    { label: 'Overhead', value: metrics.overhead_ms, desc: 'Pipeline' },
  ];

  // Calculate average from history
  const avgTotal = history.length > 0
    ? Math.round(history.reduce((sum, m) => sum + m.total_ms, 0) / history.length)
    : 0;

  return (
    <div className="latency-dashboard" id="latency-dashboard">
      <div className="latency-header">
        <h3 className="latency-title">⏱️ Latency Breakdown</h3>
        <div className="latency-total">
          <span className="latency-total-value" style={{ color: getLatencyColor(metrics.total_ms) }}>
            {Math.round(metrics.total_ms)}ms
          </span>
          <span className="latency-total-label">total</span>
        </div>
      </div>

      <div className="latency-bars">
        {components.map(({ label, value, desc }) => (
          <div key={label} className="latency-bar-row">
            <div className="latency-bar-info">
              <span className="latency-bar-label">{label}</span>
              <span className="latency-bar-value" style={{ color: getLatencyColor(value) }}>
                {Math.round(value)}ms
              </span>
            </div>
            <div className="latency-bar-track">
              <div
                className="latency-bar-fill"
                style={{
                  width: `${getBarWidth(value)}%`,
                  backgroundColor: getLatencyColor(value),
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {history.length > 1 && (
        <div className="latency-footer">
          <span className="latency-avg">
            Avg: {avgTotal}ms
          </span>
          <span className="latency-turns">
            {history.length} turns
          </span>
        </div>
      )}
    </div>
  );
}
