'use client';

import { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface SimpleAudioRecorderProps {
  sessionId: string;
  serverUrl: string;
}

export default function SimpleAudioRecorder({
  sessionId,
  serverUrl,
}: SimpleAudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [transcribedText, setTranscribedText] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Initialize Socket.io connection and create session once
  useEffect(() => {
    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to Socket.io server');
      setIsConnected(true);
      setError('');

      // Create session once on connection
      socket.emit('start-session', { sessionId });
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from Socket.io server');
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setError('Failed to connect to server');
      setIsConnected(false);
    });

    socket.on('session-started', (data) => {
      console.log('🎤 Session created:', data);
    });

    socket.on('processing-started', () => {
      console.log('🔄 Processing audio...');
      setIsProcessing(true);
    });

    socket.on('transcription', (data) => {
      console.log('📝 Transcription received:', data.text);
      setTranscribedText(data.text);
      setIsProcessing(false);
    });

    return () => {
      // Clean up session on unmount
      if (socket.connected) {
        socket.emit('stop-session', { sessionId });
      }
      socket.disconnect();
    };
  }, [serverUrl, sessionId]);

  // Visualize audio level
  const visualizeAudio = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalized = Math.min(100, (average / 255) * 100);
    setAudioLevel(normalized);

    animationFrameRef.current = requestAnimationFrame(visualizeAudio);
  };

  const startRecording = async () => {
    try {
      setError('');
      setTranscribedText('');
      audioChunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      audioStreamRef.current = stream;

      // Set up audio visualization
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      visualizeAudio();

      // Get supported MIME type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];

      let mimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 16000,
      });

      mediaRecorderRef.current = mediaRecorder;

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🎙️ Recording stopped, processing audio...');

        // Combine all chunks into a single blob
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        // Convert to array buffer
        const arrayBuffer = await audioBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Send to server for processing
        if (socketRef.current?.connected) {
          socketRef.current.emit('audio-data', {
            sessionId,
            audioData: Array.from(uint8Array),
          });
        }

        audioChunksRef.current = [];
      };

      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
        setError('Recording error occurred');
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      console.log('🎙️ Recording started');
    } catch (err: any) {
      console.error('Error starting recording:', err);

      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow access.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.');
      } else {
        setError('Failed to start recording. Please try again.');
      }
    }
  };

  const stopRecording = () => {
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop all audio tracks
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }

    // Stop audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop visualization
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setIsRecording(false);
    setAudioLevel(0);
    console.log('🛑 Recording stopped');
  };

  return (
    <div className="tap-recorder">
      <div className="recorder-status-bar">
        <div className="status-left">
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div className="session-info">Session: {sessionId}</div>
        </div>
        {isProcessing && (
          <div className="processing-indicator">
            <span className="spinner"></span>
            <span>Processing...</span>
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="recorder-main">
        <div className="tap-button-container">
          {!isRecording ? (
            <button
              className="tap-button"
              onClick={startRecording}
              disabled={!isConnected}
            >
              <div className="tap-button-inner">
                <span className="tap-icon">🎤</span>
                <span className="tap-text">Tap to Record</span>
              </div>
            </button>
          ) : (
            <button className="tap-button recording" onClick={stopRecording}>
              <div className="tap-button-inner">
                <span className="pulse-ring"></span>
                <span className="tap-icon">⏹️</span>
                <span className="tap-text">Tap to Stop</span>
              </div>
            </button>
          )}
        </div>

        {isRecording && (
          <div className="audio-visualizer-container">
            <div className="visualizer-label">Audio Level</div>
            <div className="visualizer-bar-outer">
              <div
                className="visualizer-bar-inner"
                style={{ width: `${audioLevel}%` }}
              />
            </div>
            <div className="visualizer-value">{Math.round(audioLevel)}%</div>
          </div>
        )}
      </div>

      {transcribedText && (
        <div className="transcription-result">
          <div className="transcription-header">
            <span className="transcription-icon">📝</span>
            <span className="transcription-title">Transcription</span>
          </div>
          <div className="transcription-content">{transcribedText}</div>
        </div>
      )}

      <div className="recorder-instructions">
        <h4>How to use:</h4>
        <ol>
          <li>Tap the <strong>"Tap to Record"</strong> button to start recording</li>
          <li>Speak clearly into your microphone</li>
          <li>Tap <strong>"Tap to Stop"</strong> when finished</li>
          <li>Wait for the transcription to appear below</li>
        </ol>
      </div>
    </div>
  );
}
