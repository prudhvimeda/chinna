'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useMicrophone } from '@/hooks/useMicrophone';
import { ConnectionState, PipelineStatus } from '@/lib/types';
import VoiceOrb from '@/components/VoiceOrb';
import TranscriptPanel from '@/components/TranscriptPanel';
import LatencyDashboard from '@/components/LatencyDashboard';
import { useCameraPresence } from '@/hooks/useCameraPresence';

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
    setAutoMode,
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
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [useVisualSync, setUseVisualSync] = useState(false);

  // Vision Hook
  const { 
    isUserDetected, 
    modelLoaded, 
    videoRef, 
    startCamera, 
    stopCamera 
  } = useCameraPresence();

  const isConnected = connectionState === ConnectionState.CONNECTED;

  // Handle orb click — toggle recording
  const handleOrbClick = useCallback(async () => {
    if (pipelineStatus === PipelineStatus.SPEAKING) {
      interrupt();
      return;
    }

    if (isAutoMode) return; // In auto mode, the orb is purely visual/interruptive

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
    isAutoMode,
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

  // Synchronize Auto Mode with backend
  useEffect(() => {
    setAutoMode(isAutoMode);
    
    // If turning on auto mode, start recording immediately
    if (isAutoMode && isConnected && !isRecording) {
      const initAutoRecord = async () => {
        await startRecording((audioData) => {
          sendAudio(audioData);
        });
        setAnalyserNode(getAnalyserNode());
      };
      initAutoRecord();
    }
    
    // If turning off auto mode, stop recording
    if (!isAutoMode && isRecording) {
      stopRecording();
      setAnalyserNode(null);
    }
  }, [isAutoMode, isConnected, setAutoMode, startRecording, sendAudio, getAnalyserNode, isRecording, stopRecording]);

  // Synchronize Vision with Auto Mode
  useEffect(() => {
    if (useVisualSync) {
      startCamera();
      if (isUserDetected) {
        setIsAutoMode(true);
      } else {
        setIsAutoMode(false);
      }
    } else {
      stopCamera();
    }
  }, [useVisualSync, isUserDetected, startCamera, stopCamera]);

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

  // Auto-connect on mount for true hacker feel
  useEffect(() => {
    connect();
  }, [connect]);


  return (
    <>
      {/* ElevenLabs Inspired Environment */}
      <div className="stars-bg"></div>
      <div className="ambient-halo"></div>

      <div className="floating-apps">
        <div className="floating-icon icon-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 17l6-6-6-6M12 19h8"/></svg>
        </div>
        <div className="floating-icon icon-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
        </div>
        <div className="floating-icon icon-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        </div>
        <div className="floating-icon icon-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
        </div>
      </div>

      <div className="dev-app">
        {/* Absolute top-left HUD */}
      <div className="hud top-left">
        <div className="logo-container">
          <svg className="app-logo" viewBox="0 0 100 100" width="24" height="24">
            <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="none" stroke="#64ffda" strokeWidth="6" opacity="0.8" />
            <circle cx="50" cy="50" r="28" fill="none" stroke="#ff79c6" strokeWidth="5" />
            <circle cx="50" cy="50" r="14" fill="#64ffda" opacity="0.9" style={{animation: 'pulse 2s infinite'}} />
          </svg>
          <div className="logo-text">RJ_SYS // v1.0</div>
        </div>
        <div className={`status ${isConnected ? 'online' : 'offline'}`}>
          [{isConnected ? 'SYS_ONLINE' : 'SYS_OFFLINE'}]
        </div>
        <div className="sub-status">
          <span style={{color: '#fff'}}>pipeline: </span>
          {pipelineStatus.toUpperCase()}
        </div>
        
        <div className="toggle-container" style={{ marginTop: '16px' }}>
          <label className="switch">
            <input 
                type="checkbox" 
                checked={isAutoMode} 
                onChange={() => setIsAutoMode(!isAutoMode)} 
                disabled={useVisualSync}
            />
            <span className="slider round"></span>
          </label>
          <span className="toggle-label">AUTO-VOICE</span>
        </div>

        <div className="toggle-container" style={{ marginTop: '8px' }}>
          <label className="switch">
            <input 
                type="checkbox" 
                checked={useVisualSync} 
                onChange={() => setUseVisualSync(!useVisualSync)} 
            />
            <span className="slider round green"></span>
          </label>
          <span className="toggle-label">VISUAL-SYNC {isUserDetected ? '[LOCKED]' : '[SCANNING]'}</span>
        </div>
      </div>

      {/* Hidden Vision Feed */}
      <video ref={videoRef} style={{ display: 'none' }} playsInline muted />

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
    </>
  );
}
