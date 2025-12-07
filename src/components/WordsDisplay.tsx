import { useEffect, useRef } from 'react';
import { SpeechSession } from '@/types';

interface WordsDisplayProps {
  session: SpeechSession;
  onBack: () => void;
  isPolling?: boolean;
}

export default function WordsDisplay({
  session,
  onBack,
  isPolling = false,
}: WordsDisplayProps) {
  const wordsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    wordsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [session.words]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="words-display">
      <div className="words-display-header">
        <button className="button" onClick={onBack}>
          ← Back
        </button>
        <div className="words-display-title">
          <h2>{session.sessionId}</h2>
          {isPolling && (
            <span className="polling-indicator">● Live</span>
          )}
        </div>
        <div className="words-count">
          {session.words.length} {session.words.length === 1 ? 'word' : 'words'}
        </div>
      </div>

      <div className="words-list-container">
        {session.words.length === 0 ? (
          <div className="empty-state">
            <p>No words detected yet</p>
          </div>
        ) : (
          <div className="words-list">
            {session.words.map((wordObj, index) => (
              <div key={`${wordObj.timestamp}-${index}`} className="word-item">
                <span className="word-text">{wordObj.word}</span>
                <span className="word-timestamp">
                  {formatTimestamp(wordObj.timestamp)}
                </span>
              </div>
            ))}
            <div ref={wordsEndRef} />
          </div>
        )}
      </div>

      <div className="session-meta">
        <p>
          <strong>Created:</strong>{' '}
          {new Date(session.createdAt).toLocaleString()}
        </p>
        <p>
          <strong>Last Updated:</strong>{' '}
          {new Date(session.updatedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
