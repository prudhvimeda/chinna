'use client';

import React from 'react';
import { LatencyMetrics } from '@/lib/types';

interface LatencyDashboardProps {
  metrics: LatencyMetrics | null;
  history: LatencyMetrics[];
}

export default function LatencyDashboard({ metrics, history }: LatencyDashboardProps) {
  if (!metrics) {
    return (
      <div className="metrics-panel">
        <div className="metrics-header">[ METRICS ]</div>
        <div className="metrics-empty">AWAITING_DATA...</div>
      </div>
    );
  }

  const components = [
    { label: 'ASR_MS', value: metrics.asr_ms },
    { label: 'LLM_TTFT', value: metrics.llm_ttft_ms },
    { label: 'LLM_TOT', value: metrics.llm_total_ms },
    { label: 'TTS_TTFB', value: metrics.tts_ttfb_ms },
    { label: 'SYS_OVERHEAD', value: metrics.overhead_ms },
  ];

  return (
    <div className="metrics-panel">
      <div className="metrics-header">[ LATENCY_METRICS ]</div>
      
      <div className="metrics-total">
        <span>TOT_LATENCY:</span>
        <span className="value">{(metrics.total_ms).toFixed(1)}ms</span>
      </div>

      <div className="metrics-grid">
        {components.map(({ label, value }) => (
          <div key={label} className="metric-row">
            <span className="metric-label">{label}</span>
            <span className="metric-value">
               {value.toFixed(1).padStart(6, '0')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
