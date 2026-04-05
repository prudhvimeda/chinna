'use client';

import { useRef, useCallback, useState } from 'react';
import { AUDIO_SAMPLE_RATE, AUDIO_CHANNELS } from '@/lib/constants';

interface UseMicrophoneReturn {
  isRecording: boolean;
  hasPermission: boolean | null;
  error: string | null;
  startRecording: (onAudioData: (data: ArrayBuffer) => void) => Promise<void>;
  stopRecording: () => Uint8Array | null;
  getAnalyserNode: () => AnalyserNode | null;
}

export function useMicrophone(): UseMicrophoneReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioChunksRef = useRef<Int16Array[]>([]);
  const onAudioDataRef = useRef<((data: ArrayBuffer) => void) | null>(null);

  const startRecording = useCallback(async (onAudioData: (data: ArrayBuffer) => void) => {
    try {
      setError(null);
      onAudioDataRef.current = onAudioData;

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: AUDIO_SAMPLE_RATE,
          channelCount: AUDIO_CHANNELS,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setHasPermission(true);
      mediaStreamRef.current = stream;

      // Create audio context
      const audioContext = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
      audioContextRef.current = audioContext;

      // Create analyser for visualization
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Create source from microphone
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Create script processor for raw audio access
      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);

        // Convert float32 to int16 (PCM16)
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        audioChunksRef.current.push(pcm16);

        // Send audio chunk to WebSocket
        if (onAudioDataRef.current) {
          onAudioDataRef.current(pcm16.buffer);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsRecording(true);
      audioChunksRef.current = [];

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access microphone';
      setError(message);
      setHasPermission(false);
      console.error('Microphone error:', err);
    }
  }, []);

  const stopRecording = useCallback((): Uint8Array | null => {
    // Stop all tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Disconnect processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsRecording(false);

    // Combine all audio chunks
    if (audioChunksRef.current.length === 0) return null;

    const totalLength = audioChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
    const combined = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunksRef.current) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    audioChunksRef.current = [];
    return new Uint8Array(combined.buffer);
  }, []);

  const getAnalyserNode = useCallback((): AnalyserNode | null => {
    return analyserRef.current;
  }, []);

  return {
    isRecording,
    hasPermission,
    error,
    startRecording,
    stopRecording,
    getAnalyserNode,
  };
}
