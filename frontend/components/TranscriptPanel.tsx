import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
    <div className="transcript-scroll" ref={scrollRef}>
      {messages.length === 0 && !currentResponse && (
        <div className="chat-line assistant">
          <div className="role">System</div>
          <div className="msg-content" style={{ opacity: 0.5, fontStyle: 'italic' }}>
            Awaiting secure handshake... RJ Subsystem Online.
          </div>
        </div>
      )}

      {messages.map((msg) => (
        <div key={msg.id} className={`chat-line ${msg.role}`}>
          <div className="role">{msg.role === 'user' ? 'Local_User' : 'RJ_System'}</div>
          <div className="msg-content markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {msg.content}
            </ReactMarkdown>
          </div>
        </div>
      ))}

      {/* Streaming response */}
      {currentResponse && (
        <div className="chat-line assistant">
          <div className="role">RJ_System</div>
          <div className="msg-content markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {currentResponse}
            </ReactMarkdown>
            <span className="block-cursor" style={{ marginLeft: '4px', color: 'var(--color-primary)' }}>█</span>
          </div>
        </div>
      )}
    </div>
  );
}
