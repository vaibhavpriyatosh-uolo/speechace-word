import { io, Socket } from 'socket.io-client';

interface AudioChunkMetadata {
  mimeType?: string;
  size?: number;
  duration?: number;
}

interface SessionStartedEvent {
  sessionId: string;
  timestamp: number;
}

interface ChunkReceivedEvent {
  chunkNumber: number;
  timestamp: number;
}

interface SessionStoppedEvent {
  sessionId: string;
  chunksReceived: number;
  duration: number;
}

export class SocketAudioClient {
  private socket: Socket | null = null;
  private sessionId: string | null = null;
  private isConnected: boolean = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;

  constructor(private serverUrl: string) {}

  // Connect to Socket.io server
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.serverUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5,
        });

        this.socket.on('connect', () => {
          console.log('✅ Connected to Socket.io server');
          this.isConnected = true;
          resolve();
        });

        this.socket.on('disconnect', () => {
          console.log('❌ Disconnected from Socket.io server');
          this.isConnected = false;
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ Connection error:', error);
          reject(error);
        });

        this.socket.on('error', (error) => {
          console.error('💥 Socket error:', error);
        });

        // Handle session events
        this.socket.on('session-started', (data: SessionStartedEvent) => {
          console.log('🎤 Session started:', data);
        });

        this.socket.on('chunk-received', (data: ChunkReceivedEvent) => {
          console.log(`📦 Chunk #${data.chunkNumber} received by server`);
        });

        this.socket.on('session-stopped', (data: SessionStoppedEvent) => {
          console.log('⏹️  Session stopped:', data);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Start audio capture and streaming
  async startAudioCapture(sessionId: string): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error('Not connected to server');
    }

    this.sessionId = sessionId;

    // Emit start session event
    this.socket.emit('start-session', { sessionId });

    try {
      // Request microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000, // 16kHz is standard for speech recognition
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create MediaRecorder
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType,
        audioBitsPerSecond: 16000,
      });

      // Handle data available event
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.socket && this.sessionId) {
          // Convert Blob to ArrayBuffer
          event.data.arrayBuffer().then((arrayBuffer) => {
            this.socket!.emit('audio-chunk', {
              sessionId: this.sessionId,
              audioData: Array.from(new Uint8Array(arrayBuffer)),
              metadata: {
                mimeType,
                size: arrayBuffer.byteLength,
                duration: event.timecode,
              } as AudioChunkMetadata,
            });
          });
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
      };

      // Start recording in chunks (e.g., every 1 second)
      this.mediaRecorder.start(1000);

      console.log('🎙️  Audio capture started');
    } catch (error) {
      console.error('❌ Error starting audio capture:', error);
      throw error;
    }
  }

  // Stop audio capture
  stopAudioCapture(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      console.log('🛑 MediaRecorder stopped');
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
      console.log('🔇 Audio stream stopped');
    }

    if (this.socket && this.sessionId) {
      this.socket.emit('stop-session', { sessionId: this.sessionId });
    }

    this.sessionId = null;
  }

  // Disconnect from server
  disconnect(): void {
    this.stopAudioCapture();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    console.log('🔌 Disconnected');
  }

  // Get supported MIME type
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return '';
  }

  // Check if connected
  isSocketConnected(): boolean {
    return this.isConnected;
  }

  // Check if recording
  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }
}
