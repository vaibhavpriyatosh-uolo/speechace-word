'use client';

import { useState, useEffect, useRef } from 'react';
import { SocketAudioClient } from '@/lib/socket-client';

interface AudioRecorderProps {
  sessionId: string;
  serverUrl: string;
}

export default function AudioRecorder({ sessionId, serverUrl }: AudioRecorderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const clientRef = useRef<SocketAudioClient | null>(null);

  useEffect(() => {
    // Initialize client
    clientRef.current = new SocketAudioClient(serverUrl);

    return () => {
      // Cleanup on unmount
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, [serverUrl]);

  const handleConnect = async () => {
    if (!clientRef.current) return;

    try {
      setError('');
      setStatusMessage('Connecting to server...');
      await clientRef.current.connect();
      setIsConnected(true);
      setStatusMessage('Connected to server');
    } catch (err) {
      setError('Failed to connect to server');
      setStatusMessage('');
      console.error(err);
    }
  };

  const handleStartRecording = async () => {
    if (!clientRef.current || !isConnected) {
      setError('Not connected to server');
      return;
    }

    try {
      setError('');
      setStatusMessage('Starting audio capture...');
      await clientRef.current.startAudioCapture(sessionId);
      setIsRecording(true);
      setStatusMessage('Recording...');
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found');
      } else {
        setError('Failed to start recording');
      }
      setStatusMessage('');
      console.error(err);
    }
  };

  const handleStopRecording = () => {
    if (!clientRef.current) return;

    clientRef.current.stopAudioCapture();
    setIsRecording(false);
    setStatusMessage('Recording stopped');
  };

  const handleDisconnect = () => {
    if (!clientRef.current) return;

    clientRef.current.disconnect();
    setIsConnected(false);
    setIsRecording(false);
    setStatusMessage('Disconnected');
  };

  return (
    <div className="audio-recorder">
      <div className="recorder-header">
        <h3>Audio Recorder</h3>
        <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </div>

      <div className="recorder-info">
        <p>
          <strong>Session ID:</strong> {sessionId}
        </p>
        {statusMessage && (
          <p className="status-message">{statusMessage}</p>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="recorder-controls">
        {!isConnected ? (
          <button className="button" onClick={handleConnect}>
            Connect to Server
          </button>
        ) : (
          <>
            {!isRecording ? (
              <button className="button button-success" onClick={handleStartRecording}>
                🎤 Start Recording
              </button>
            ) : (
              <button className="button button-danger" onClick={handleStopRecording}>
                ⏹️ Stop Recording
              </button>
            )}
            <button className="button button-secondary" onClick={handleDisconnect}>
              Disconnect
            </button>
          </>
        )}
      </div>

      {isRecording && (
        <div className="recording-indicator">
          <div className="recording-pulse"></div>
          <span>Recording in progress...</span>
        </div>
      )}

      <div className="recorder-help">
        <p>
          <strong>How it works:</strong>
        </p>
        <ol>
          <li>Click &quot;Connect to Server&quot; to establish connection</li>
          <li>Click &quot;Start Recording&quot; to begin audio capture</li>
          <li>Speak into your microphone</li>
          <li>Audio chunks are sent to the server for processing</li>
          <li>Recognized words will appear in the session below</li>
          <li>Click &quot;Stop Recording&quot; when done</li>
        </ol>
      </div>
    </div>
  );
}
