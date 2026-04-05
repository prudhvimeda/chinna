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

  const getDialColor = () => {
    if (status === PipelineStatus.SPEAKING) return 'rgba(255, 255, 255, 0.8)';
    if (status === PipelineStatus.THINKING) return 'rgba(255, 121, 198, 0.8)';
    if (isRecording) return 'rgba(79, 209, 197, 0.8)';
    return 'rgba(255, 255, 255, 0.3)';
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 500; 
    canvas.width = size;
    canvas.height = size;
    const cx = size / 2;
    const cy = size / 2;

    let time = 0;
    const baseOrbRadius = 130;
    const ringRadius = 180;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      let audioVolume = 0;
      let audioData = new Uint8Array(0);

      if (analyserNode && (isRecording || status === PipelineStatus.SPEAKING)) {
        audioData = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteFrequencyData(audioData);
        const sum = audioData.slice(0, 50).reduce((a, b) => a + b, 0); 
        audioVolume = sum / (50 * 255); // normalized
      }

      time += status === PipelineStatus.IDLE && !isRecording ? 0.005 : 0.02;

      // 1. Draw 3D Gel Orb
      const currentRadius = baseOrbRadius + (audioVolume * 25);
      
      // We simulate a 3D dented/wavy gel by drawing multiple offset gradients
      ctx.save();
      ctx.translate(cx, cy);
      
      // Rotate the entire gel effect slowly
      ctx.rotate(time * 0.5);

      // Main shape is a slightly deformed circle
      ctx.beginPath();
      for (let i = 0; i <= Math.PI * 2; i += 0.1) {
        // Subtle deformation based on time/volume
        const deform = Math.sin(i * 3 + time * 2) * (10 + (audioVolume * 20));
        const r = currentRadius + deform;
        const x = Math.cos(i) * r;
        const y = Math.sin(i) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Shadow/Inner Glow for 3D effect
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 10;
      ctx.shadowOffsetY = 10;

      // Create complex shading gradient (Teal/Cyan gel)
      let color1, color2, color3;
      if (status === PipelineStatus.THINKING) {
        color1 = '#ff79c6'; color2 = '#bd93f9'; color3 = '#6272a4';
      } else if (status === PipelineStatus.SPEAKING) {
        color1 = '#f8f8f2'; color2 = '#8be9fd'; color3 = '#4fd1c5';
      } else {
        // ElevenLabs Teal look
        color1 = '#81e6d9'; color2 = '#38b2ac'; color3 = '#2c7a7b';
      }

      const grad = ctx.createRadialGradient(-30, -30, 10, 0, 0, currentRadius);
      grad.addColorStop(0, color1);
      grad.addColorStop(0.5, color2);
      grad.addColorStop(1, color3);

      ctx.fillStyle = grad;
      ctx.fill();

      // Add "dented" inner lighting to simulate smooth cloth/gel folds
      ctx.shadowColor = 'transparent';
      const innerGrad = ctx.createRadialGradient(20, 20, 0, 0, 0, currentRadius);
      innerGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
      innerGrad.addColorStop(0.4, 'rgba(255,255,255,0)');
      innerGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
      
      ctx.fillStyle = innerGrad;
      ctx.fill();

      ctx.restore();

      // 2. Draw Dashed Tuning Ring
      ctx.save();
      ctx.translate(cx, cy);
      // Ring reacts to volume
      const currentRingRadius = ringRadius + (audioVolume * 15);
      
      // Rotate the ring based on time
      ctx.rotate(-time * 0.8);
      
      ctx.lineWidth = 4;
      ctx.strokeStyle = getDialColor();
      
      // Draw ticks (dashed logic)
      const numTicks = 60;
      for (let i = 0; i < numTicks; i++) {
        const angle = (i / numTicks) * Math.PI * 2;
        // Make some ticks longer/shorter randomly for audio effect or organically
        let tickLength = 12;
        
        // If recording, ticks react to audio frequencies
        if (audioData.length > 0) {
            const bin = Math.floor((i / numTicks) * (audioData.length * 0.5));
            const amp = audioData[bin] / 255;
            tickLength = 12 + (amp * 30);
            
            // Highlight ticks that are very loud
            if (amp > 0.5) {
                ctx.strokeStyle = '#fff';
            } else {
                ctx.strokeStyle = getDialColor();
            }
        }

        ctx.beginPath();
        const startX = Math.cos(angle) * (currentRingRadius);
        const startY = Math.sin(angle) * (currentRingRadius);
        const endX = Math.cos(angle) * (currentRingRadius + tickLength);
        const endY = Math.sin(angle) * (currentRingRadius + tickLength);
        
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }

      ctx.restore();
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationRef.current);
  }, [analyserNode, isRecording, status]);

  return (
    <div 
      className="blob-container" 
      onClick={onClick}
      aria-label="Toggle Voice Interaction"
    >
      <canvas 
        ref={canvasRef} 
        className={`blob-canvas ${isRecording || status !== PipelineStatus.IDLE ? 'active' : ''}`} 
      />
      {status === PipelineStatus.IDLE && !isRecording && (
        <div className="blob-hint">TAP OR SPACEBAR</div>
      )}
    </div>
  );
}
