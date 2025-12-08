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
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [transcriptions, setTranscriptions] = useState<string[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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
      setTranscriptions((prev) => [...prev, data.text]);
      setIsProcessing(false);
    });

    socket.on('transcription-error', (data) => {
      console.error('❌ Transcription error:', data.error);
      setError(`Transcription failed: ${data.error}`);
      setIsProcessing(false);

      // Clear error after 5 seconds
      setTimeout(() => setError(''), 5000);
    });

    return () => {
      // Clean up session on unmount
      if (socket.connected) {
        socket.emit('stop-session', { sessionId });
      }
      socket.disconnect();
    };
  }, [serverUrl, sessionId]);

  // Start listening automatically when connected
  useEffect(() => {
    if (isConnected && !isListening) {
      startListening();
    }
  }, [isConnected]);

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

  const startListening = async () => {
    try {
      setError('');

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

      // Create MediaRecorder with 5-second chunks
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 16000,
      });

      mediaRecorderRef.current = mediaRecorder;

      // Collect and send audio chunks - restart recorder for proper WebM headers
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && socketRef.current?.connected) {
          // Convert to array buffer
          const arrayBuffer = await event.data.arrayBuffer();

          // Skip if audio is too small (less than 1KB)
          if (arrayBuffer.byteLength < 1000) {
            console.log('⏭️ Skipping small audio chunk');

            // Restart recording for next chunk
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
              mediaRecorderRef.current.start();
            }
            return;
          }

          const uint8Array = new Uint8Array(arrayBuffer);

          // Send to server for processing
          socketRef.current.emit('audio-data', {
            sessionId,
            audioData: Array.from(uint8Array),
          });

          console.log(`📤 Sent audio chunk (${arrayBuffer.byteLength} bytes)`);

          // Restart recording for next chunk (creates proper WebM header)
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
            mediaRecorderRef.current.start();
          }
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
        setError('Recording error occurred');
      };

      // Start recording - will auto-restart after each chunk
      mediaRecorder.start();

      // Set up interval to stop/restart recorder every 5 seconds for proper WebM chunks
      const recordingInterval = setInterval(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 5000);

      // Store interval ref for cleanup
      (mediaRecorder as any).recordingInterval = recordingInterval;

      setIsListening(true);
      console.log('🎙️ Continuous listening started (5-second chunks with proper headers)');
    } catch (err: any) {
      console.error('Error starting listening:', err);

      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow access and refresh.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.');
      } else {
        setError('Failed to start listening. Please try again.');
      }
    }
  };

  const stopListening = () => {
    // Clear recording interval
    if (mediaRecorderRef.current && (mediaRecorderRef.current as any).recordingInterval) {
      clearInterval((mediaRecorderRef.current as any).recordingInterval);
    }

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

    setIsListening(false);
    setAudioLevel(0);
    console.log('🛑 Listening stopped');
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  return (
    <div className="continuous-recorder">
      <div className="recorder-status-bar">
        <div className="status-left">
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div className="session-info">Session: {sessionId}</div>
        </div>
        {isListening && (
          <div className="listening-indicator">
            <span className="listening-pulse"></span>
            <span>Listening...</span>
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
        <div className="listening-animation">
          <div className={`mic-icon ${isListening ? 'active' : ''}`}>
            <span>🎤</span>
            {isListening && (
              <>
                <span className="wave wave-1"></span>
                <span className="wave wave-2"></span>
                <span className="wave wave-3"></span>
              </>
            )}
          </div>
          <div className="listening-text">
            {isListening ? 'Listening continuously...' : 'Connecting...'}
          </div>
        </div>

        {isListening && (
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

        {isProcessing && (
          <div className="processing-indicator-card">
            <span className="spinner"></span>
            <span>Processing audio...</span>
          </div>
        )}
      </div>

      {transcriptions.length > 0 && (
        <div className="transcriptions-container">
          <div className="transcriptions-header">
            <span className="transcriptions-icon">📝</span>
            <span className="transcriptions-title">Transcriptions</span>
            <span className="transcriptions-count">{transcriptions.length}</span>
          </div>
          <div className="transcriptions-list">
            {transcriptions.map((text, index) => (
              <div key={index} className="transcription-item">
                <div className="transcription-number">#{index + 1}</div>
                <div className="transcription-text">{text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="recorder-instructions">
        <h4>How it works:</h4>
        <ul>
          <li>Microphone starts listening automatically when you select a session</li>
          <li>Audio is captured in 5-second chunks</li>
          <li>Each chunk is sent to the server for transcription</li>
          <li>Transcriptions appear below as they are processed</li>
          <li>Keep speaking naturally - the system is always listening</li>
        </ul>
      </div>
    </div>
  );
}
