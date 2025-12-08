require('dotenv').config({ path: '.env.local' });

const { createServer } = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const OpenAI = require('openai');
const { Ollama } = require('ollama');
const fs = require('fs');
const path = require('path');

const PORT = process.env.SOCKET_PORT || 4000;
const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
console.log({ OPENAI_API_KEY });
// Initialize OpenAI client
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// Initialize Ollama client
const ollama = new Ollama({ host: 'http://localhost:11434' });
const OLLAMA_MODEL = 'dimavz/whisper-tiny:latest';

// Create HTTP server
const httpServer = createServer();

// Create Socket.io server with CORS
const io = new Server(httpServer, {
  cors: {
    origin:
      process.env.NODE_ENV === 'production'
        ? [process.env.FRONTEND_URL, process.env.NEXT_PUBLIC_API_URL].filter(
            Boolean
          )
        : '*', // Allow all origins for development
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Store active sessions
const activeSessions = new Map();

// Audio chunk buffer storage (stores chunks temporarily before processing)
const audioBuffers = new Map();

// Track accumulated audio data per session for batching
const sessionAudioAccumulator = new Map();

// Minimum audio duration for STT processing (in seconds)
const MIN_AUDIO_DURATION = 5;
const CHUNK_DURATION = 1; // Each chunk is 1 second

console.log('🚀 Socket.io server starting...');

io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  // Handle session start
  socket.on('start-session', ({ sessionId }) => {
    console.log(`🎤 Session started: ${sessionId} by ${socket.id}`);

    // Store session info
    activeSessions.set(socket.id, {
      sessionId,
      startTime: Date.now(),
      chunksReceived: 0,
    });

    // Initialize audio buffer for this session
    if (!audioBuffers.has(sessionId)) {
      audioBuffers.set(sessionId, []);
    }

    // Send acknowledgment
    socket.emit('session-started', {
      sessionId,
      timestamp: Date.now(),
    });
  });

  // Handle audio chunk
  socket.on('audio-chunk', async ({ sessionId, audioData, metadata }) => {
    const session = activeSessions.get(socket.id);

    if (!session || session.sessionId !== sessionId) {
      socket.emit('error', { message: 'Invalid session' });
      return;
    }

    // Increment chunk counter
    session.chunksReceived++;

    console.log(
      `🎵 Audio chunk received for session: ${sessionId} (chunk #${session.chunksReceived})`
    );

    // Store audio chunk in buffer
    const buffer = audioBuffers.get(sessionId) || [];
    buffer.push({
      data: audioData,
      timestamp: Date.now(),
      metadata,
    });
    audioBuffers.set(sessionId, buffer);

    // Send acknowledgment immediately (non-blocking)
    socket.emit('chunk-received', {
      chunkNumber: session.chunksReceived,
      timestamp: Date.now(),
    });

    // Initialize accumulator for this session if not exists
    if (!sessionAudioAccumulator.has(sessionId)) {
      sessionAudioAccumulator.set(sessionId, {
        chunks: [],
        chunkCount: 0,
        isProcessing: false,
      });
    }

    const accumulator = sessionAudioAccumulator.get(sessionId);

    // Add chunk to accumulator
    accumulator.chunks.push(audioData);
    accumulator.chunkCount++;

    // Process audio asynchronously every MIN_AUDIO_DURATION seconds
    // This allows continuous audio intake without blocking
    if (
      accumulator.chunkCount >= MIN_AUDIO_DURATION &&
      !accumulator.isProcessing
    ) {
      // Set processing flag
      accumulator.isProcessing = true;

      // Get accumulated audio data
      const accumulatedAudio = accumulator.chunks.flat();

      // Clear accumulator for next batch
      accumulator.chunks = [];
      accumulator.chunkCount = 0;

      // Process asynchronously (non-blocking)
      processAudioAsync(sessionId, accumulatedAudio).finally(() => {
        accumulator.isProcessing = false;
      });
    }
  });

  // Handle session stop
  socket.on('stop-session', async ({ sessionId }) => {
    console.log(`⏹️  Session stopped: ${sessionId}`);

    const session = activeSessions.get(socket.id);
    if (session) {
      // Process any remaining audio chunks before stopping
      const accumulator = sessionAudioAccumulator.get(sessionId);
      if (
        accumulator &&
        accumulator.chunks.length > 0 &&
        !accumulator.isProcessing
      ) {
        console.log(
          `🔄 Processing remaining ${accumulator.chunks.length} chunks before stopping`
        );
        const remainingAudio = accumulator.chunks.flat();
        await processAudioAsync(sessionId, remainingAudio);
      }

      // Clean up
      sessionAudioAccumulator.delete(sessionId);
      audioBuffers.delete(sessionId);

      socket.emit('session-stopped', {
        sessionId,
        chunksReceived: session.chunksReceived,
        duration: Date.now() - session.startTime,
      });

      activeSessions.delete(socket.id);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);

    const session = activeSessions.get(socket.id);
    if (session) {
      console.log(`🔒 Cleaning up session: ${session.sessionId}`);
      activeSessions.delete(socket.id);
    }
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error(`💥 Socket error for ${socket.id}:`, error);
  });
});

/**
 * Process audio data asynchronously without blocking incoming chunks
 */
async function processAudioAsync(sessionId, audioData) {
  try {
    console.log(
      `🔄 Processing ${audioData.length} bytes of audio for session ${sessionId}`
    );
    await speechToText(audioData, sessionId);
  } catch (error) {
    console.error(
      `❌ Error processing audio for session ${sessionId}:`,
      error.message
    );
  }
}

/**
 * Three-Tier Speech-to-Text Orchestrator
 * Tries each tier in sequence with automatic fallback
 */
async function speechToText(audioData, sessionId) {
  // Tier 1: Try Ollama Whisper (local, free, fast)
  // try {
  //   console.log('🔄 [Tier 1] Trying Ollama Whisper (local)...');
  //   return await ollamaSpeechToText(audioData, sessionId);
  // } catch (error) {
  //   console.warn(`⚠️  [Tier 1] Ollama failed: ${error.message}`);
  //   // Continue to next tier
  // }

  // Tier 2: Try OpenAI Whisper (cloud, accurate, paid)
  if (openai) {
    try {
      console.log('🔄 [Tier 2] Trying OpenAI Whisper (cloud)...');
      return await openaiSpeechToText(audioData, sessionId);
    } catch (error) {
      console.warn(`⚠️  [Tier 2] OpenAI failed: ${error.message}`);
      // Continue to next tier
    }
  }

  // Tier 3: Fallback simulation (testing only)
  console.log('🔄 [Tier 3] Using fallback simulation');
  return await fallbackSpeechDetection(sessionId);
}

/**
 * Ollama Whisper Speech-to-Text (Local, Free)
 * Uses whisper-tiny model via Ollama
 */
async function ollamaSpeechToText(audioData, sessionId) {
  try {
    // Create temporary file for audio data
    console.log('1');
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    console.log('2');
    const tempFile = path.join(tempDir, `${sessionId}-${Date.now()}.webm`);
    console.log('3');
    // Convert audio data array to Buffer
    const audioBuffer = Buffer.from(audioData);
    console.log('4');
    // Write audio to temporary file
    fs.writeFileSync(tempFile, audioBuffer);

    // Call Ollama with the audio file
    console.log('5');
    const audioBase64 = fs.readFileSync(tempFile).toString('base64');
    const response = await ollama.generate({
      model: 'openbmb/minicpm-o2.6:latest',
      // some Ollama builds accept `audio` field by analogy with `images`
      audio: audioBase64,
      // optional: tell the model you just want plain transcript
      prompt:
        'Transcribe the audio to plain text (include timestamps only if requested).',
      format: 'json', // or 'text' if you prefer raw text
    });
    // Clean up temporary file
    fs.unlinkSync(tempFile);
    console.log({ response });
    const transcribedText = response.response?.trim();

    if (transcribedText && transcribedText.length > 0) {
      console.log(
        `🎯 [Ollama] Transcribed: "${transcribedText}" for session ${sessionId}`
      );

      // Split into words and send each word
      const words = transcribedText
        .split(/\s+/)
        .filter((word) => word.length > 0);

      for (const word of words) {
        await sendWordToAPI(sessionId, word);
      }

      return transcribedText;
    } else {
      console.log(`🔇 [Ollama] No speech detected for session ${sessionId}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ [Ollama] Error:`, error.message);

    // Clean up temp file if it exists
    try {
      const tempFiles = fs
        .readdirSync(path.join(__dirname, 'temp'))
        .filter((file) => file.startsWith(sessionId));
      tempFiles.forEach((file) => {
        fs.unlinkSync(path.join(__dirname, 'temp', file));
      });
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    throw error; // Throw to trigger fallback
  }
}

/**
 * OpenAI Whisper Speech-to-Text (Cloud, High Accuracy)
 * Processes audio data asynchronously without blocking incoming audio
 */
async function openaiSpeechToText(audioData, sessionId) {
  // If OpenAI is not configured, throw error to cascade to next tier
  console.log('OPENAI 1');
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }
  console.log('OPENAI 2');

  try {
    // Create temporary file for audio data
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    console.log('OPENAI 3');
    const tempFile = path.join(tempDir, `${sessionId}-${Date.now()}.webm`);

    // Convert audio data array to Buffer
    const audioBuffer = Buffer.from(audioData);
    console.log('OPENAI 4');
    // Write audio to temporary file
    fs.writeFileSync(tempFile, audioBuffer);

    // Create a read stream for the file
    const audioStream = fs.createReadStream(tempFile);
    console.log('OPENAI 5');
    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      language: 'en',
      response_format: 'json',
    });
    console.log('OPENAI 6');
    // Clean up temporary file
    fs.unlinkSync(tempFile);
    console.log({ transcription });
    // Extract transcribed text
    const transcribedText = transcription.text?.trim();

    if (transcribedText && transcribedText.length > 0) {
      console.log(
        `🎯 [OpenAI] Transcribed: "${transcribedText}" for session ${sessionId}`
      );

      // Split into words and send each word
      const words = transcribedText
        .split(/\s+/)
        .filter((word) => word.length > 0)
        .join(' ');

      await sendWordToAPI(sessionId, words);

      return transcribedText;
    } else {
      console.log(`🔇 [OpenAI] No speech detected for session ${sessionId}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ [OpenAI] Error:`, error.message);

    // Clean up temp file if it exists
    try {
      const tempFiles = fs
        .readdirSync(path.join(__dirname, 'temp'))
        .filter((file) => file.startsWith(sessionId));
      tempFiles.forEach((file) => {
        fs.unlinkSync(path.join(__dirname, 'temp', file));
      });
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    throw error; // Throw to trigger fallback
  }
}

/**
 * Send detected word to the speech detection API
 */
async function sendWordToAPI(sessionId, word) {
  try {
    const temp = await axios.post(`${API_URL}/speech-detection`, {
      sessionId,
      word: word.toLowerCase(),
    });
    console.log({ temp });
    console.log(`📝 Word saved: "${word}" for session ${sessionId}`);
  } catch (error) {
    console.error(`❌ Error saving word:`, error.message);
  }
}

/**
 * Fallback speech detection for testing without OpenAI API
 */
async function fallbackSpeechDetection(sessionId) {
  const words = [
    'hello',
    'world',
    'test',
    'audio',
    'stream',
    'speech',
    'recognition',
    'system',
  ];
  const randomWord = words[Math.floor(Math.random() * words.length)];

  await sendWordToAPI(sessionId, randomWord);
  return randomWord;
}

// Check Ollama availability and start server
let ollamaAvailable = false;

async function startServer() {
  // Check Ollama availability first
  try {
    await ollama.list();
    ollamaAvailable = true;
    console.log('✅ Ollama service detected');
  } catch (error) {
    ollamaAvailable = false;
    console.log('⚠️  Ollama service not running');
  }

  // Start server after checking Ollama
  httpServer.listen(PORT, () => {
    console.log(`\n🎧 Socket.io server running on port ${PORT}`);
    console.log(`📡 API URL: ${API_URL}`);
    console.log(`\n📊 Speech-to-Text Services:`);
    console.log(
      `  Tier 1 - Ollama Whisper (local): ${
        ollamaAvailable ? '✅ Enabled' : '❌ Disabled (Start Ollama first)'
      }`
    );
    console.log(
      `  Tier 2 - OpenAI Whisper (cloud): ${
        openai ? '✅ Enabled' : '❌ Disabled (Add API key)'
      }`
    );
    console.log(`  Tier 3 - Fallback Simulation: ✅ Enabled`);
    console.log(`\n🔗 Connect clients to: http://localhost:${PORT}\n`);
  });
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n⚠️  SIGTERM received, closing server...');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT received, closing server...');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
