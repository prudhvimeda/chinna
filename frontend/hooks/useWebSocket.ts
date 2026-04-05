'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { EventType, WSEvent, PipelineStatus, ConnectionState, LatencyMetrics, Message } from '@/lib/types';
import { WS_URL, WS_RECONNECT_DELAY_MS, WS_MAX_RECONNECT_ATTEMPTS } from '@/lib/constants';

interface UseWebSocketReturn {
  connectionState: ConnectionState;
  pipelineStatus: PipelineStatus;
  messages: Message[];
  currentResponse: string;
  latencyMetrics: LatencyMetrics | null;
  latencyHistory: LatencyMetrics[];
  sendEvent: (event: WSEvent) => void;
  sendAudio: (data: ArrayBuffer) => void;
  startListening: () => void;
  stopListening: () => void;
  interrupt: () => void;
  setAutoMode: (enabled: boolean) => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>(PipelineStatus.IDLE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [latencyMetrics, setLatencyMetrics] = useState<LatencyMetrics | null>(null);
  const [latencyHistory, setLatencyHistory] = useState<LatencyMetrics[]>([]);

  const currentResponseRef = useRef('');

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const wsEvent: WSEvent = JSON.parse(event.data);

      switch (wsEvent.type) {
        case EventType.STATUS:
          setPipelineStatus((wsEvent.data?.status as PipelineStatus) || PipelineStatus.IDLE);
          break;

        case EventType.TRANSCRIPT_PARTIAL:
          // Could show interim results
          break;

        case EventType.TRANSCRIPT_FINAL: {
          const text = wsEvent.data?.text as string;
          if (text) {
            setMessages(prev => [...prev, {
              id: crypto.randomUUID(),
              role: 'user',
              content: text,
              timestamp: new Date(),
            }]);
          }
          break;
        }

        case EventType.LLM_TOKEN: {
          const token = wsEvent.data?.token as string;
          if (token) {
            currentResponseRef.current += token;
            setCurrentResponse(currentResponseRef.current);
          }
          break;
        }

        case EventType.LLM_COMPLETE: {
          const fullText = wsEvent.data?.text as string;
          if (fullText) {
            setMessages(prev => [...prev, {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: fullText,
              timestamp: new Date(),
            }]);
            currentResponseRef.current = '';
            setCurrentResponse('');
          }
          break;
        }

        case EventType.TTS_AUDIO: {
          const audioBase64 = wsEvent.data?.audio as string;
          const sampleRate = (wsEvent.data?.sample_rate as number) || 24000;
          if (audioBase64) {
            playAudioChunk(audioBase64, sampleRate);
          }
          break;
        }

        case EventType.LATENCY_REPORT: {
          const metrics = wsEvent.data as unknown as LatencyMetrics;
          if (metrics) {
            setLatencyMetrics(metrics);
            setLatencyHistory(prev => [...prev.slice(-49), metrics]);
          }
          break;
        }

        case EventType.ERROR: {
          console.error('Pipeline error:', wsEvent.data?.message);
          break;
        }

        default:
          break;
      }
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionState(ConnectionState.CONNECTING);

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionState(ConnectionState.CONNECTED);
      reconnectAttempts.current = 0;
      console.log('🔗 Connected to Chinna backend');
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      setConnectionState(ConnectionState.DISCONNECTED);
      setPipelineStatus(PipelineStatus.IDLE);

      // Auto-reconnect
      if (reconnectAttempts.current < WS_MAX_RECONNECT_ATTEMPTS) {
        const delay = WS_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts.current);
        reconnectTimer.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      setConnectionState(ConnectionState.ERROR);
    };
  }, [handleMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
    }
    reconnectAttempts.current = WS_MAX_RECONNECT_ATTEMPTS; // Prevent reconnect
    wsRef.current?.close();
    wsRef.current = null;
    setConnectionState(ConnectionState.DISCONNECTED);
  }, []);

  const sendEvent = useCallback((event: WSEvent) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  }, []);

  const sendAudio = useCallback((data: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const startListening = useCallback(() => {
    sendEvent({ type: EventType.START_LISTENING });
  }, [sendEvent]);

  const stopListening = useCallback(() => {
    sendEvent({ type: EventType.STOP_LISTENING });
  }, [sendEvent]);

  const interrupt = useCallback(() => {
    sendEvent({ type: EventType.INTERRUPT });
    currentResponseRef.current = '';
    setCurrentResponse('');
  }, [sendEvent]);

  const setAutoMode = useCallback((enabled: boolean) => {
    sendEvent({ 
      type: EventType.SET_AUTO_MODE,
      data: { enabled } as any
    });
  }, [sendEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionState,
    pipelineStatus,
    messages,
    currentResponse,
    latencyMetrics,
    latencyHistory,
    sendEvent,
    sendAudio,
    startListening,
    stopListening,
    interrupt,
    setAutoMode,
    connect,
    disconnect,
  };
}

// ── Audio Playback ───────────────────────────────────────────

let audioContext: AudioContext | null = null;
const audioQueue: { buffer: AudioBuffer; }[] = [];
let isPlaying = false;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

async function playAudioChunk(base64Audio: string, sampleRate: number) {
  try {
    const ctx = getAudioContext();

    // Decode base64 to ArrayBuffer
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decode audio
    const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));

    audioQueue.push({ buffer: audioBuffer });

    if (!isPlaying) {
      playNextInQueue(ctx);
    }
  } catch (e) {
    console.error('Audio playback error:', e);
  }
}

function playNextInQueue(ctx: AudioContext) {
  if (audioQueue.length === 0) {
    isPlaying = false;
    return;
  }

  isPlaying = true;
  const { buffer } = audioQueue.shift()!;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.onended = () => playNextInQueue(ctx);
  source.start();
}
