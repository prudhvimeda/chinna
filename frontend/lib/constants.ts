/**
 * Chinna AI Voice Assistant — Constants
 */

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Audio configuration
export const AUDIO_SAMPLE_RATE = 16000;
export const AUDIO_CHANNELS = 1;
export const AUDIO_CHUNK_MS = 100; // Send audio every 100ms

// Reconnection
export const WS_RECONNECT_DELAY_MS = 1000;
export const WS_MAX_RECONNECT_ATTEMPTS = 5;

// UI
export const ORB_IDLE_SIZE = 160;
export const ORB_ACTIVE_SIZE = 200;
export const TRANSCRIPT_MAX_MESSAGES = 50;

// Latency thresholds (ms)
export const LATENCY_GOOD = 200;
export const LATENCY_WARN = 500;
export const LATENCY_BAD = 1000;
