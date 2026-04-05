'use client';

import React from 'react';
import { ConnectionState, PipelineStatus } from '@/lib/types';

interface StatusIndicatorProps {
  connectionState: ConnectionState;
  pipelineStatus: PipelineStatus;
}

export default function StatusIndicator({ connectionState, pipelineStatus }: StatusIndicatorProps) {
  const getConnectionInfo = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return { label: 'Connected', className: 'status--connected', icon: '🟢' };
      case ConnectionState.CONNECTING:
        return { label: 'Connecting...', className: 'status--connecting', icon: '🟡' };
      case ConnectionState.DISCONNECTED:
        return { label: 'Disconnected', className: 'status--disconnected', icon: '🔴' };
      case ConnectionState.ERROR:
        return { label: 'Error', className: 'status--error', icon: '🔴' };
    }
  };

  const info = getConnectionInfo();

  return (
    <div className={`status-indicator ${info.className}`} id="status-indicator">
      <span className="status-dot">{info.icon}</span>
      <span className="status-label">{info.label}</span>
      {connectionState === ConnectionState.CONNECTED && pipelineStatus !== PipelineStatus.IDLE && (
        <span className="status-pipeline">• {pipelineStatus}</span>
      )}
    </div>
  );
}
