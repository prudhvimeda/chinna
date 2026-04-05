'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useMicrophone } from '@/hooks/useMicrophone';
import { ConnectionState, PipelineStatus } from '@/lib/types';
import VoiceOrb from '@/components/VoiceOrb';
import TranscriptPanel from '@/components/TranscriptPanel';
import StatusIndicator from '@/components/StatusIndicator';
import LatencyDashboard from '@/components/LatencyDashboard';

export default function Home() {
  const {
    connectionState,
    pipelineStatus,
    messages,
    currentResponse,
    latencyMetrics,
    latencyHistory,
    sendAudio,
    startListening,
    stopListening,
    interrupt,
    connect,
    disconnect,
  } = useWebSocket();

  const {
    isRecording,
    startRecording,
    stopRecording,
    getAnalyserNode,
  } = useMicrophone();

  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  // Handle orb click — toggle recording
  const handleOrbClick = useCallback(async () => {
    if (pipelineStatus === PipelineStatus.SPEAKING) {
      // Interrupt if assistant is speaking
      interrupt();
      return;
    }

    if (isRecording) {
      // Stop recording and send audio
      stopListening();
      stopRecording();
      setAnalyserNode(null);
    } else {
      if (connectionState !== ConnectionState.CONNECTED) {
        return;
      }
      // Start recording
      startListening();
      await startRecording((audioData) => {
        sendAudio(audioData);
      });
      setAnalyserNode(getAnalyserNode());
    }
  }, [
    isRecording,
    connectionState,
    pipelineStatus,
    startRecording,
    stopRecording,
    sendAudio,
    startListening,
    stopListening,
    interrupt,
    getAnalyserNode,
  ]);

  // Keyboard shortcut: Space to toggle recording
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

  const isConnected = connectionState === ConnectionState.CONNECTED;

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <span className="app-logo-icon">🤖</span>
          <span className="app-logo-text">Chinna</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <StatusIndicator
            connectionState={connectionState}
            pipelineStatus={pipelineStatus}
          />
          {!isConnected ? (
            <button className="connect-btn" onClick={connect} id="connect-btn">
              ⚡ Connect
            </button>
          ) : (
            <button
              className="connect-btn connect-btn--disconnect"
              onClick={disconnect}
              id="disconnect-btn"
            >
              Disconnect
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Center: Voice Orb + Transcript */}
        <div className="app-center">
          <VoiceOrb
            status={pipelineStatus}
            isRecording={isRecording}
            onClick={handleOrbClick}
            analyserNode={analyserNode}
          />

          {!isConnected && (
            <div style={{
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontSize: '0.9rem',
            }}>
              <p>Click <strong>Connect</strong> to start talking to Chinna</p>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                Make sure the backend is running on port 8000
              </p>
            </div>
          )}

          <div className="keyboard-hint">
            <span>Press</span>
            <kbd className="kbd">Space</kbd>
            <span>to talk</span>
          </div>

          <TranscriptPanel
            messages={messages}
            currentResponse={currentResponse}
          />
        </div>

        {/* Sidebar: Latency Dashboard */}
        <aside className="app-sidebar">
          <LatencyDashboard
            metrics={latencyMetrics}
            history={latencyHistory}
          />

          {/* Pipeline Info */}
          <div className="latency-dashboard">
            <h3 className="latency-title">🏗️ Pipeline</h3>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginTop: '12px',
              fontSize: '0.8rem',
              color: 'var(--color-text-secondary)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>ASR</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                  faster-whisper
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>LLM</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
                  Ollama / Llama 3.2
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>TTS</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>
                  Kokoro-82M
                </span>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
