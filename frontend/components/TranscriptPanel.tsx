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

  return (
    <div className="terminal-panel" ref={scrollRef}>
      <div className="terminal-header">
        <span className="terminal-dot red"></span>
        <span className="terminal-dot yellow"></span>
        <span className="terminal-dot green"></span>
        <span className="terminal-title">rj — bash</span>
      </div>
      <div className="terminal-body">
        {messages.length === 0 && !currentResponse && (
          <div className="terminal-line system">
            <span className="prompt">~ %</span> RJ AI Subsystem Online. Awaiting input...
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`terminal-line ${msg.role === 'user' ? 'user' : 'assistant'}`}
          >
            {msg.role === 'user' ? (
              <>
                <span className="prompt">user@local ~ %</span> 
                <span className="text">{msg.content}</span>
              </>
            ) : (
              <>
                <span className="prompt assistant-prompt">rj ~ %</span> 
                <span className="text assistant-text">{msg.content}</span>
              </>
            )}
          </div>
        ))}

        {/* Streaming response */}
        {currentResponse && (
          <div className="terminal-line assistant streaming">
            <span className="prompt assistant-prompt">rj ~ %</span> 
            <span className="text assistant-text">{currentResponse}</span>
            <span className="block-cursor">█</span>
          </div>
        )}
      </div>
    </div>
  );
}
