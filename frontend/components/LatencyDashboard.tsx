'use client';

import React from 'react';
import { LatencyMetrics } from '@/lib/types';

interface LatencyDashboardProps {
  metrics: LatencyMetrics | null;
  history?: LatencyMetrics[];
}

export default function LatencyDashboard({ metrics }: LatencyDashboardProps) {
  if (!metrics) {
    return (
      <div className="metrics-v2">
        <div className="sys-status-indicator">
          <div className="status-dot online" />
          CALIBRATING_SENSORS...
        </div>
      </div>
    );
  }

  const items = [
    { label: 'ASR', value: metrics.asr_ms, unit: 'ms' },
    { label: 'TTFT', value: metrics.llm_ttft_ms, unit: 'ms' },
    { label: 'LLM', value: metrics.llm_total_ms, unit: 'ms' },
    { label: 'TTS', value: metrics.tts_ttfb_ms, unit: 'ms' },
  ];

  return (
    <div className="metrics-v2">
      {items.map((item) => (
        <div key={item.label} className="metric-pill">
          <span className="label">{item.label}</span>
          <div className="value">
            {Math.round(item.value)}
            <span className="unit">{item.unit}</span>
          </div>
        </div>
      ))}
      <div className="e2e-total">
        <span className="label">E2E_TOTAL</span>
        <span className="value">
          {metrics.total_ms.toFixed(1)}
          <span className="unit" style={{ color: 'var(--color-primary)' }}>ms</span>
        </span>
      </div>
    </div>
  );
}
