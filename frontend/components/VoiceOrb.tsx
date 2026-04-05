'use client';

import React, { useRef, useEffect } from 'react';
import { PipelineStatus } from '@/lib/types';

interface VoiceOrbProps {
  status: PipelineStatus;
  isRecording: boolean;
  onClick: () => void;
  analyserNode: AnalyserNode | null;
}

export default function VoiceOrb({ status, isRecording, onClick, analyserNode }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // Determine visual state
  const getStatusClass = () => {
    if (isRecording) return 'orb--listening';
    switch (status) {
      case PipelineStatus.LISTENING: return 'orb--listening';
      case PipelineStatus.TRANSCRIBING: return 'orb--processing';
      case PipelineStatus.THINKING: return 'orb--thinking';
      case PipelineStatus.SPEAKING: return 'orb--speaking';
      case PipelineStatus.ERROR: return 'orb--error';
      default: return 'orb--idle';
    }
  };

  const getStatusLabel = () => {
    if (isRecording) return 'Listening...';
    switch (status) {
      case PipelineStatus.LISTENING: return 'Listening...';
      case PipelineStatus.TRANSCRIBING: return 'Transcribing...';
      case PipelineStatus.THINKING: return 'Thinking...';
      case PipelineStatus.SPEAKING: return 'Speaking...';
      case PipelineStatus.ERROR: return 'Error';
      default: return 'Tap to speak';
    }
  };

  // Audio visualization on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 280;
    canvas.width = size;
    canvas.height = size;

    const centerX = size / 2;
    const centerY = size / 2;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      if (analyserNode && isRecording) {
        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteFrequencyData(dataArray);

        // Draw frequency-reactive rings
        const numRings = 3;
        for (let ring = 0; ring < numRings; ring++) {
          const avgFreq = dataArray.slice(ring * 20, (ring + 1) * 20)
            .reduce((a, b) => a + b, 0) / 20;
          const scale = 1 + (avgFreq / 255) * 0.3;
          const radius = (50 + ring * 20) * scale;
          const opacity = 0.15 - ring * 0.04;

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(99, 179, 237, ${opacity})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [analyserNode, isRecording]);

  return (
    <div className="orb-container">
      <canvas ref={canvasRef} className="orb-canvas" />
      <button
        className={`orb ${getStatusClass()}`}
        onClick={onClick}
        aria-label={getStatusLabel()}
        id="voice-orb-button"
      >
        <div className="orb-inner">
          <div className="orb-glow" />
          <div className="orb-icon">
            {isRecording || status === PipelineStatus.LISTENING ? (
              <MicIcon />
            ) : status === PipelineStatus.THINKING ? (
              <BrainIcon />
            ) : status === PipelineStatus.SPEAKING ? (
              <SpeakerIcon />
            ) : (
              <MicIcon />
            )}
          </div>
        </div>
      </button>
      <p className="orb-label">{getStatusLabel()}</p>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────

function MicIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}
