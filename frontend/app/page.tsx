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
      interrupt();
      return;
    }

    if (isRecording) {
      stopListening();
      stopRecording();
      setAnalyserNode(null);
    } else {
      if (connectionState !== ConnectionState.CONNECTED) {
        connect();
        return;
      }
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
    connect,
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

  // Auto-connect on mount for true hacker feel
  useEffect(() => {
    connect();
  }, [connect]);


  return (
    <div className="dev-app">
      {/* Absolute top-left HUD */}
      <div className="hud top-left">
        <div className="logo-text">RJ_SYS // v1.0</div>
        <div className={`status ${isConnected ? 'online' : 'offline'}`}>
          [{isConnected ? 'SYS_ONLINE' : 'SYS_OFFLINE'}]
        </div>
        <div className="sub-status">
          <span style={{color: '#fff'}}>pipeline: </span>
          {pipelineStatus.toUpperCase()}
        </div>
      </div>

      {/* Absolute top-right HUD */}
      <div className="hud top-right text-right">
        <div>ASR: <span className="highlight">faster-whisper</span></div>
        <div>LLM: <span className="highlight">llama3.2</span></div>
        <div>TTS: <span className="highlight">kokoro-82m</span></div>
      </div>

      {/* Center Stage: Blob Canvas */}
      <main className="stage">
        <VoiceOrb
          status={pipelineStatus}
          isRecording={isRecording}
          onClick={handleOrbClick}
          analyserNode={analyserNode}
        />
        
        {!isConnected && (
            <div className="connection-error" onClick={connect}>
                ERR_CONNECTION_REFUSED. Click to retry.
            </div>
        )}
      </main>

      {/* Bottom Layout: Terminal + Latency Stack */}
      <div className="bottom-hud">
        <div className="terminal-wrapper">
          <TranscriptPanel
            messages={messages}
            currentResponse={currentResponse}
          />
        </div>

        <div className="metrics-wrapper">
           <LatencyDashboard
              metrics={latencyMetrics}
              history={latencyHistory}
           />
        </div>
      </div>
    </div>
  );
}
