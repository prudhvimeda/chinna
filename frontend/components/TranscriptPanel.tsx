'use client';

import React, { useRef, useEffect } from 'react';
import { Message } from '@/lib/types';

interface TranscriptPanelProps {
  messages: Message[];
  currentResponse: string;
}

export default function TranscriptPanel({ messages, currentResponse }: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentResponse]);

  if (messages.length === 0 && !currentResponse) {
    return (
      <div className="transcript-panel" id="transcript-panel">
        <div className="transcript-empty">
          <p className="transcript-empty-icon">💬</p>
          <p className="transcript-empty-text">Start a conversation with Chinna</p>
          <p className="transcript-empty-hint">Click the orb and speak</p>
        </div>
      </div>
    );
  }

  return (
    <div className="transcript-panel" id="transcript-panel" ref={scrollRef}>
      <div className="transcript-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`transcript-message transcript-message--${msg.role}`}
          >
            <div className="transcript-message-avatar">
              {msg.role === 'user' ? '🧑' : '🤖'}
            </div>
            <div className="transcript-message-content">
              <span className="transcript-message-role">
                {msg.role === 'user' ? 'You' : 'Chinna'}
              </span>
              <p className="transcript-message-text">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Streaming response */}
        {currentResponse && (
          <div className="transcript-message transcript-message--assistant transcript-message--streaming">
            <div className="transcript-message-avatar">🤖</div>
            <div className="transcript-message-content">
              <span className="transcript-message-role">Chinna</span>
              <p className="transcript-message-text">
                {currentResponse}
                <span className="typing-cursor">|</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
