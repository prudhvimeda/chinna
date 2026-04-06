'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useMicrophone } from '@/hooks/useMicrophone';
import { ConnectionState, PipelineStatus } from '@/lib/types';
import VoiceOrb from '@/components/VoiceOrb';
import TranscriptPanel from '@/components/TranscriptPanel';
import LatencyDashboard from '@/components/LatencyDashboard';

export default function Home() {
  const {
    connectionState,
    pipelineStatus,
    messages,
    currentResponse,
    latencyMetrics,
    sendAudio,
    startListening,
    stopListening,
    interrupt,
    connect,
  } = useWebSocket();

  const {
    isRecording,
    startRecording,
    stopRecording,
    getAnalyserNode,
  } = useMicrophone();

  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const isConnected = connectionState === ConnectionState.CONNECTED;

  const startTurn = useCallback(async () => {
    if (isRecording || !isConnected) return;
    startListening();
    await startRecording((audioData) => {
      sendAudio(audioData);
    });
    setAnalyserNode(getAnalyserNode());
  }, [isRecording, isConnected, startListening, startRecording, sendAudio, getAnalyserNode]);

  const stopTurn = useCallback(() => {
    if (!isRecording) return;
    stopListening();
    stopRecording();
    setAnalyserNode(null);
  }, [isRecording, stopListening, stopRecording]);

  const handleOrbClick = useCallback(async () => {
    if (pipelineStatus === PipelineStatus.SPEAKING) {
      interrupt();
      return;
    }
    if (isRecording) {
      stopTurn();
    } else {
      await startTurn();
    }
  }, [isRecording, pipelineStatus, interrupt, startTurn, stopTurn]);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        handleOrbClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOrbClick]);

  return (
    <>
      <div className="mesh-gradient" />
      
      {/* --- Top HUD: System Identity --- */}
      <div className="stark-hud top-left" style={{ top: '40px', left: '40px' }}>
        <div className="hud-glass stark-logo-wrapper">
          <svg className="app-logo" viewBox="0 0 100 100" width="22" height="22">
            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--color-primary)" strokeWidth="8" strokeDasharray="20 10" />
            <circle cx="50" cy="50" r="25" fill="var(--color-primary)" />
          </svg>
          <div className="logo-text">RJ_Subsystem // v2.0</div>
        </div>
        
        <div className="sys-status-indicator" style={{ marginTop: '16px', marginLeft: '20px' }}>
          <div className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
          {isConnected ? 'STARK_NET_STABLE' : 'LINK_ESTABLISHING...'}
        </div>
      </div>

      {/* --- Main Interaction Stage --- */}
      <main className="main-stage">
        <VoiceOrb
          status={pipelineStatus}
          isRecording={isRecording}
          onClick={handleOrbClick}
          analyserNode={analyserNode}
        />
        
        {!isConnected && (
            <div className="connection-error" onClick={connect} style={{ borderRadius: '12px', background: 'rgba(255,0,0,0.1)', border: '1px solid #ff5555' }}>
                CRITICAL_LINK_FAILURE. RE-ENGAGE?
            </div>
        )}
      </main>

      {/* --- Bottom Dashboard: Intelligence HUD --- */}
      <div className="bottom-dashboard">
        <div className="hud-glass glass-card transcript-section">
          <TranscriptPanel
            messages={messages}
            currentResponse={currentResponse}
          />
        </div>

        <div className="hud-glass glass-card metrics-section">
          <LatencyDashboard
            metrics={latencyMetrics}
          />
        </div>
      </div>
    </>
  );
}
