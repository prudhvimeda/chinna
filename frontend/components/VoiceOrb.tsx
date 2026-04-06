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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 600;
    canvas.width = size;
    canvas.height = size;
    const cx = size / 2;
    const cy = size / 2;

    let time = 0;
    const baseRadius = 140;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      let volume = 0;
      if (analyserNode && (isRecording || status === PipelineStatus.SPEAKING)) {
        const data = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteFrequencyData(data);
        volume = data.slice(0, 40).reduce((a, b) => a + b, 0) / (40 * 255);
      }

      time += (status === PipelineStatus.IDLE && !isRecording) ? 0.008 : 0.02 + (volume * 0.05);

      // --- Layer 1: Core Glow ---
      drawBlob(ctx, cx, cy, baseRadius * 0.8, time, volume, status, isRecording, 1);
      
      // --- Layer 2: Swirling Mid ---
      ctx.globalCompositeOperation = 'screen';
      drawBlob(ctx, cx, cy, baseRadius, time * 0.7, volume, status, isRecording, 0.6);
      
      // --- Layer 3: Outer Aura ---
      drawBlob(ctx, cx, cy, baseRadius * 1.2, time * 0.4, volume, status, isRecording, 0.3);
      
      ctx.globalCompositeOperation = 'source-over';

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationRef.current);
  }, [analyserNode, isRecording, status]);

  const drawBlob = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    t: number,
    vol: number,
    status: PipelineStatus,
    isRecording: boolean,
    opacity: number
  ) => {
    const points = 80;
    const currentRadius = radius + (vol * 40);

    let c1, c2;
    if (status === PipelineStatus.THINKING) {
      c1 = `rgba(255, 121, 198, ${opacity})`;
      c2 = `rgba(189, 147, 249, ${opacity * 0.5})`;
    } else if (status === PipelineStatus.SPEAKING) {
      c1 = `rgba(100, 255, 218, ${opacity})`;
      c2 = `rgba(139, 233, 253, ${opacity * 0.5})`;
    } else if (isRecording) {
      c1 = `rgba(79, 209, 197, ${opacity})`;
      c2 = `rgba(44, 122, 123, ${opacity * 0.5})`;
    } else {
      c1 = `rgba(255, 255, 255, ${opacity * 0.2})`;
      c2 = `rgba(255, 255, 255, ${opacity * 0.05})`;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.2);

    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      
      // Multi-octave "noise"
      const noise1 = Math.sin(angle * 3 + t * 2) * (15 + vol * 30);
      const noise2 = Math.cos(angle * 5 - t * 1.5) * (10 + vol * 20);
      const noise3 = Math.sin(angle * 2 + t * 4) * (5 + vol * 10);
      
      const r = currentRadius + noise1 + noise2 + noise3;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    const grad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, currentRadius);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);

    ctx.fillStyle = grad;
    ctx.fill();

    // Subtle edge highlight
    if (opacity > 0.5) {
      ctx.strokeStyle = `rgba(255,255,255,${opacity * 0.3})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  };

  return (
    <div 
      className={`orb-center-wrapper ${status === PipelineStatus.THINKING ? 'thinking' : ''}`}
      onClick={onClick}
    >
      <canvas ref={canvasRef} className="orb-canvas" />
      {status === PipelineStatus.IDLE && !isRecording && (
        <div className="tap-indicator">Initialization Sequence: Ready</div>
      )}
    </div>
  );
}
