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
  const [chunksCount, setChunksCount] = useState(0);
  const [error, setError] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize Socket.io connection
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
      console.log('🎤 Session started:', data);
    });

    socket.on('chunk-received', (data) => {
      console.log(`✅ Chunk #${data.chunkNumber} received`);
      setChunksCount(data.chunkNumber);
    });

    return () => {
      socket.disconnect();
    };
  }, [serverUrl]);

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

      // Emit session start
      if (socketRef.current) {
        socketRef.current.emit('start-session', { sessionId });
      }

      // Handle data available (1-second chunks)
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && socketRef.current?.connected) {
          // Convert Blob to ArrayBuffer
          const arrayBuffer = await event.data.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Send to server
          socketRef.current.emit('audio-chunk', {
            sessionId,
            audioData: Array.from(uint8Array),
            metadata: {
              mimeType,
              size: arrayBuffer.byteLength,
              timestamp: Date.now(),
            },
          });

          console.log(`📤 Sent audio chunk (${arrayBuffer.byteLength} bytes)`);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
        setError('Recording error occurred');
      };

      mediaRecorder.onstop = () => {
        console.log('⏹️  Recording stopped');
      };

      // Start recording with 1-second time slices
      mediaRecorder.start(1000); // 1000ms = 1 second chunks

      setIsRecording(true);
      setChunksCount(0);
      console.log('🎙️  Recording started (1-second chunks)');
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

    // Emit session stop
    if (socketRef.current) {
      socketRef.current.emit('stop-session', { sessionId });
    }

    setIsRecording(false);
    setAudioLevel(0);
    console.log('🛑 Recording stopped');
  };

  return (
    <div className="simple-audio-recorder">
      <div className="recorder-header">
        <h3>🎤 Audio Recorder</h3>
        <div className={`connection-badge ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </div>

      <div className="recorder-info-box">
        <div className="info-item">
          <span className="info-label">Session:</span>
          <span className="info-value">{sessionId}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Chunks Sent:</span>
          <span className="info-value">{chunksCount}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Chunk Size:</span>
          <span className="info-value">1 second</span>
        </div>
      </div>

      {error && (
        <div className="error-box">
          ⚠️ {error}
        </div>
      )}

      <div className="recorder-controls-center">
        {!isRecording ? (
          <button
            className="record-button"
            onClick={startRecording}
            disabled={!isConnected}
          >
            <span className="record-icon">🎙️</span>
            <span>Start Recording</span>
          </button>
        ) : (
          <button className="stop-button" onClick={stopRecording}>
            <span className="stop-icon">⏹️</span>
            <span>Stop Recording</span>
          </button>
        )}
      </div>

      {isRecording && (
        <div className="recording-status">
          <div className="pulse-dot"></div>
          <span>Recording in progress...</span>
          <span className="chunks-indicator">Chunks sent: {chunksCount}</span>
        </div>
      )}

      {isRecording && (
        <div className="audio-visualizer">
          <div className="visualizer-label">Audio Level:</div>
          <div className="visualizer-bar-container">
            <div
              className="visualizer-bar"
              style={{ width: `${audioLevel}%` }}
            />
          </div>
          <div className="visualizer-level">{Math.round(audioLevel)}%</div>
        </div>
      )}

      <div className="recorder-instructions">
        <h4>📋 Instructions:</h4>
        <ol>
          <li>Ensure your microphone is connected</li>
          <li>Click <strong>&quot;Start Recording&quot;</strong> button</li>
          <li>Allow microphone permission when prompted</li>
          <li>Speak clearly into your microphone</li>
          <li>Audio is automatically sent in 1-second chunks</li>
          <li>Click <strong>&quot;Stop Recording&quot;</strong> when done</li>
        </ol>
        <p className="tech-note">
          <strong>Technical:</strong> Audio is captured at 16kHz mono, optimized for speech recognition
        </p>
      </div>
    </div>
  );
}
