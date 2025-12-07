'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { SpeechSession } from '@/types';
import SessionList from '@/components/SessionList';
import WordsDisplay from '@/components/WordsDisplay';
import SimpleAudioRecorder from '@/components/SimpleAudioRecorder';

export default function SpeechDetectionPage() {
  const [sessions, setSessions] = useState<string[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SpeechSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionAndStartPolling(selectedSessionId);
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [selectedSessionId]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.speechDetection.getAllSessions();
      setSessions(response.data.data.sessions || []);
    } catch (err) {
      setError('Failed to fetch sessions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSession = async (sessionId: string) => {
    try {
      const response = await api.speechDetection.getSession(sessionId);
      const newSession = response.data.data;

      if (
        !selectedSession ||
        newSession.words.length !== selectedSession.words.length
      ) {
        setSelectedSession(newSession);
      }
    } catch (err) {
      console.error('Error fetching session:', err);
      setError('Failed to fetch session details');
    }
  };

  const fetchSessionAndStartPolling = async (sessionId: string) => {
    stopPolling();

    await fetchSession(sessionId);

    pollingIntervalRef.current = setInterval(() => {
      fetchSession(sessionId);
    }, 2000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setError('');
  };

  const handleBack = () => {
    setSelectedSessionId(null);
    setSelectedSession(null);
    stopPolling();
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm(`Are you sure you want to delete session "${sessionId}"?`)) {
      return;
    }

    try {
      setError('');
      await api.speechDetection.deleteSession(sessionId);

      if (selectedSessionId === sessionId) {
        handleBack();
      }

      await fetchSessions();
    } catch (err) {
      setError('Failed to delete session');
      console.error(err);
    }
  };

  return (
    <>
      <header className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Speech Detection Sessions</h1>
          <nav style={{ display: 'flex', gap: '1rem' }}>
            <a href="/" style={{ color: '#0070f3', fontWeight: 500 }}>Home</a>
            <a href="/speech" style={{ color: '#0070f3', fontWeight: 500 }}>Speech Detection</a>
            <a href="/record" style={{ color: '#0070f3', fontWeight: 500 }}>Record</a>
          </nav>
        </div>
      </header>

      <div className="container">
        {error && <div className="error">{error}</div>}

        {selectedSessionId && (
          <div className="audio-recorder-section">
            <SimpleAudioRecorder
              sessionId={selectedSessionId}
              serverUrl={process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:4000'}
            />
          </div>
        )}

        <div className="speech-container">
          <div className="sessions-panel">
            <h2>Sessions</h2>
            {loading ? (
              <div className="loading">Loading sessions...</div>
            ) : (
              <SessionList
                sessions={sessions}
                selectedSessionId={selectedSessionId}
                onSelectSession={handleSelectSession}
                onDeleteSession={handleDeleteSession}
              />
            )}
          </div>

          <div className="words-panel">
            {!selectedSessionId ? (
              <div className="empty-state">
                <h2>Select a session</h2>
                <p>Choose a session from the list to view detected words</p>
              </div>
            ) : selectedSession ? (
              <WordsDisplay
                session={selectedSession}
                onBack={handleBack}
                isPolling={pollingIntervalRef.current !== null}
              />
            ) : (
              <div className="loading">Loading session details...</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
