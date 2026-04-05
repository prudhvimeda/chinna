/**
 * Chinna AI Voice Assistant — Shared TypeScript Types
 */

// ── WebSocket Event Types ────────────────────────────────────

export enum EventType {
  // Client → Server
  AUDIO_CHUNK = 'audio_chunk',
  START_LISTENING = 'start_listening',
  STOP_LISTENING = 'stop_listening',
  INTERRUPT = 'interrupt',
  CONFIG_UPDATE = 'config_update',

  // Server → Client
  TRANSCRIPT_PARTIAL = 'transcript_partial',
  TRANSCRIPT_FINAL = 'transcript_final',
  LLM_TOKEN = 'llm_token',
  LLM_COMPLETE = 'llm_complete',
  TTS_AUDIO = 'tts_audio',
  TTS_COMPLETE = 'tts_complete',

  // Bidirectional
  ERROR = 'error',
  LATENCY_REPORT = 'latency_report',
  STATUS = 'status',
  PING = 'ping',
  PONG = 'pong',
}

export enum PipelineStatus {
  IDLE = 'idle',
  LISTENING = 'listening',
  TRANSCRIBING = 'transcribing',
  THINKING = 'thinking',
  SPEAKING = 'speaking',
  ERROR = 'error',
}

export interface WSEvent {
  type: EventType;
  data?: Record<string, unknown>;
  session_id?: string;
  timestamp?: string;
}

// ── Latency Metrics ──────────────────────────────────────────

export interface LatencyMetrics {
  turn_id: string;
  asr_ms: number;
  llm_ttft_ms: number;
  llm_total_ms: number;
  tts_ttfb_ms: number;
  tts_total_ms: number;
  overhead_ms: number;
  total_ms: number;
  timestamp: string;
}

// ── Conversation ─────────────────────────────────────────────

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ── Connection State ─────────────────────────────────────────

export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}
