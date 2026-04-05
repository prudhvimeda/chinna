'use client';

import React, { useRef, useEffect } from 'react';
import { PipelineStatus } from '@/lib/types';

interface VoiceOrbProps {
  status: PipelineStatus;
  isRecording: boolean;
  onClick: () => void;
  analyserNode: AnalyserNode | null;
}

// Helper for soft noise to make the blob organic
class Noise {
  private p: Uint8Array;
  constructor() {
    this.p = new Uint8Array(512);
    for (let i = 0; i < 256; i++) this.p[i] = Math.floor(Math.random() * 256);
    for (let i = 0; i < 256; i++) this.p[i + 256] = this.p[i];
  }

  private fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
  private lerp(t: number, a: number, b: number) { return a + t * (b - a); }
  private grad(hash: number, x: number, y: number, z: number) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise(x: number, y: number, z: number) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = this.fade(x), v = this.fade(y), w = this.fade(z);
    const A = this.p[X] + Y, AA = this.p[A] + Z, AB = this.p[A + 1] + Z;
    const B = this.p[X + 1] + Y, BA = this.p[B] + Z, BB = this.p[B + 1] + Z;

    return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.p[AA], x, y, z),
      this.grad(this.p[BA], x - 1, y, z)),
      this.lerp(u, this.grad(this.p[AB], x, y - 1, z),
        this.grad(this.p[BB], x - 1, y - 1, z))),
      this.lerp(v, this.lerp(u, this.grad(this.p[AA + 1], x, y, z - 1),
        this.grad(this.p[BA + 1], x - 1, y, z - 1)),
        this.lerp(u, this.grad(this.p[AB + 1], x, y - 1, z - 1),
          this.grad(this.p[BB + 1], x - 1, y - 1, z - 1))));
  }
}

export default function VoiceOrb({ status, isRecording, onClick, analyserNode }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const noiseRef = useRef(new Noise());

  const getStatusColor = () => {
    if (isRecording) return '110, 190, 255'; // Vibrant Blue
    switch (status) {
      case PipelineStatus.LISTENING: return '110, 190, 255';
      case PipelineStatus.TRANSCRIBING:
      case PipelineStatus.THINKING: return '160, 110, 255'; // Magenta / Violet
      case PipelineStatus.SPEAKING: return '255, 255, 255'; // Pure White for assistant
      case PipelineStatus.ERROR: return '255, 80, 80'; // Red
      default: return '40, 40, 50'; // Dull grey for idle
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use a high resolution canvas but displayed smaller for crispness
    const size = 600; 
    canvas.width = size;
    canvas.height = size;
    const cx = size / 2;
    const cy = size / 2;

    let time = 0;
    const maxRadius = 120;
    const numPoints = 150;
    const noiseCalc = noiseRef.current;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      let audioVolume = 0;
      let audioData = new Uint8Array(0);

      // Analyze real-time audio if available
      if (analyserNode && (isRecording || status === PipelineStatus.SPEAKING)) {
        audioData = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteFrequencyData(audioData);
        const sum = audioData.slice(0, 50).reduce((a, b) => a + b, 0); // focus on lower freqs
        audioVolume = sum / (50 * 255); // normalized 0-1
      }

      // Base radius fluctuates heavily with audio volume
      const dynamicRadius = maxRadius + (audioVolume * 100); 
      
      const rgb = getStatusColor();
      const isIdle = !isRecording && status === PipelineStatus.IDLE;
      const speed = isIdle ? 0.005 : (isRecording ? 0.02 : 0.05);
      
      time += speed + (audioVolume * 0.05);

      ctx.beginPath();

      // Draw the blob
      for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        
        // Map 2D circle to 3D noise space for seamless loop
        const nx = Math.cos(angle) + 1; 
        const ny = Math.sin(angle) + 1;
        
        // Noise magnitude increases with audio volume
        const noiseMagnitude = isIdle ? 0.2 : 0.5 + (audioVolume * 2);
        
        // Add high frequency jitter if thinking/speaking based on actual frequency bands
        let freqAmp = 0;
        if (audioData.length > 0) {
            const bin = Math.floor((i / numPoints) * (audioData.length * 0.25));
            freqAmp = (audioData[bin] / 255) * 40 * audioVolume;
        }

        const n = noiseCalc.noise(nx * 1.5, ny * 1.5, time) * noiseMagnitude;
        const r = dynamicRadius * (1 + n) + freqAmp;

        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();

      // Core blob fill
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, dynamicRadius * 1.5);
      grad.addColorStop(0, `rgba(${rgb}, 0.9)`);
      if (status === PipelineStatus.THINKING) {
         grad.addColorStop(0.5, `rgba(100, 200, 255, 0.5)`);
      }
      grad.addColorStop(1, `rgba(${rgb}, 0.0)`);
      
      ctx.fillStyle = grad;
      ctx.fill();

      // Sharp edge rim
      ctx.strokeStyle = `rgba(${rgb}, ${isIdle ? 0.3 : 1})`;
      ctx.lineWidth = isIdle ? 1 : 2 + (audioVolume * 5);
      ctx.stroke();

      // Outer glow based on volume
      if (audioVolume > 0.1 || status === PipelineStatus.THINKING) {
        ctx.shadowBlur = 40 + (audioVolume * 60);
        ctx.shadowColor = `rgba(${rgb}, 0.6)`;
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      }

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
        <div className="blob-hint">SPACEBAR</div>
      )}
    </div>
  );
}
