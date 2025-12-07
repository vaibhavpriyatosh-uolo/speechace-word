'use client';

import { useState, useEffect } from 'react';
import SimpleAudioRecorder from '@/components/SimpleAudioRecorder';
import { api } from '@/lib/api';
import type { SpeechSession, SpeechWord } from '@/types';

export default function RecordPage() {
  const [sessionId, setSessionId] = useState('');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [detectedWords, setDetectedWords] = useState<SpeechWord[]>([]);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [error, setError] = useState('');

  // Generate random session ID
  const generateSessionId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `record-${timestamp}-${random}`;
  };

  // Poll for detected words
  useEffect(() => {
    if (!isSessionActive || !sessionId) return;

    const fetchWords = async () => {
      try {
        const response = await api.speechDetection.getSession(sessionId);
        if (response.data.success && response.data.data) {
          setDetectedWords(response.data.data.words);
        }
      } catch (err: any) {
        // Session might not exist yet, that's okay
        if (err.response?.status !== 404) {
          console.error('Error fetching words:', err);
        }
      }
    };

    // Fetch immediately
    fetchWords();

    // Poll every 1 second for real-time updates
    const interval = setInterval(fetchWords, 1000);
    setPollingInterval(interval);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isSessionActive, sessionId]);

  const handleStartSession = () => {
    if (!sessionId.trim()) {
      setError('Please enter or generate a session ID');
      return;
    }
    setError('');
    setIsSessionActive(true);
    setDetectedWords([]);
  };

  const handleStopSession = () => {
    setIsSessionActive(false);
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  const handleGenerateId = () => {
    const newId = generateSessionId();
    setSessionId(newId);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="record-page">
      <div className="record-header">
        <h1>🎙️ Audio Recording Studio</h1>
        <p className="record-subtitle">
          Record audio in real-time with automatic 1-second chunk streaming
        </p>
      </div>

      <div className="record-container">
        {/* Session Setup Section */}
        <div className="session-setup-section">
          <h2>📋 Session Setup</h2>

          {!isSessionActive ? (
            <>
              <div className="session-id-input-group">
                <label htmlFor="sessionId">Session ID:</label>
                <div className="input-with-button">
                  <input
                    id="sessionId"
                    type="text"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    placeholder="Enter session ID or generate one"
                    className="session-input"
                  />
                  <button
                    onClick={handleGenerateId}
                    className="generate-button"
                  >
                    🎲 Generate
                  </button>
                </div>
              </div>

              {error && (
                <div className="error-message">
                  ⚠️ {error}
                </div>
              )}

              <button
                onClick={handleStartSession}
                className="start-session-button"
                disabled={!sessionId.trim()}
              >
                ▶️ Start Recording Session
              </button>
            </>
          ) : (
            <div className="active-session-info">
              <div className="session-badge">
                <span className="badge-label">Active Session:</span>
                <span className="badge-value">{sessionId}</span>
              </div>
              <button
                onClick={handleStopSession}
                className="stop-session-button"
              >
                ⏹️ Stop Session
              </button>
            </div>
          )}
        </div>

        {/* Recording Section */}
        {isSessionActive && (
          <div className="recording-section">
            <SimpleAudioRecorder
              sessionId={sessionId}
              serverUrl={process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:4000'}
            />
          </div>
        )}

        {/* Detected Words Section */}
        {isSessionActive && (
          <div className="detected-words-section">
            <div className="words-header">
              <h2>💬 Detected Words</h2>
              <span className="word-count">
                {detectedWords.length} {detectedWords.length === 1 ? 'word' : 'words'}
              </span>
            </div>

            <div className="words-container">
              {detectedWords.length === 0 ? (
                <div className="empty-words-state">
                  <p>🎤 Speak into your microphone</p>
                  <p className="small-text">Detected words will appear here in real-time</p>
                </div>
              ) : (
                <div className="words-list">
                  {detectedWords.map((wordItem, index) => (
                    <div key={index} className="word-card">
                      <span className="word-text">{wordItem.word}</span>
                      <span className="word-time">
                        {formatTimestamp(wordItem.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="record-navigation">
        <a href="/" className="nav-link">
          🏠 Home
        </a>
        <a href="/speech" className="nav-link">
          📊 Speech Detection
        </a>
      </div>
    </div>
  );
}
