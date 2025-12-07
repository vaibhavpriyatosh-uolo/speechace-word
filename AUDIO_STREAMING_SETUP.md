# Audio Streaming Setup Complete! 🎤

## What's Been Created

### 1. Socket.io Server
**Location**: `server/socket-server.js`

A standalone WebSocket server that handles real-time audio streaming from clients.

**Features**:
- Accepts WebSocket connections from clients
- Receives audio chunks in real-time
- Processes audio data (currently simulated)
- Sends detected words to the Next.js API
- Session management and error handling

**Port**: 4000 (configurable via `SOCKET_PORT` env variable)

### 2. Client-Side Socket Handler
**Location**: `src/lib/socket-client.ts`

TypeScript class for managing Socket.io connections and audio capture.

**Features**:
- Connect/disconnect from Socket.io server
- Capture audio from microphone using MediaRecorder API
- Stream audio chunks in real-time
- Handle connection states and errors
- Optimized audio settings for speech recognition (16kHz, mono)

### 3. AudioRecorder Component
**Location**: `src/components/AudioRecorder.tsx`

React component providing UI for audio recording.

**Features**:
- Connect to Socket.io server
- Start/stop recording buttons
- Real-time recording status
- Connection indicator
- Error messages and help text

### 4. Integration
- AudioRecorder integrated into `/speech` page
- Appears when a session is selected
- Sends audio to Socket.io server
- Detected words appear in real-time below

## How to Use

### Start Both Servers

**Terminal 1** - Next.js Server:
```bash
npm run dev
```
Access at: http://localhost:3001

**Terminal 2** - Socket.io Server:
```bash
npm run dev:socket
```
Running on: http://localhost:4000

### Using the Audio Recorder

1. Navigate to: http://localhost:3001/speech
2. Select or create a session
3. The AudioRecorder component will appear
4. Click "Connect to Server"
5. Click "Start Recording"
6. Allow microphone permission
7. Speak into your microphone
8. Audio chunks are sent to the server
9. Detected words appear in the session display below

## Architecture

```
┌─────────────────┐
│   Browser       │
│  /speech page   │
└────────┬────────┘
         │
         │ 1. User speaks
         │
┌────────▼────────┐
│ AudioRecorder   │
│   Component     │
└────────┬────────┘
         │
         │ 2. Capture audio chunks
         │
┌────────▼────────┐
│ SocketAudioClient│
│  (socket-client)│
└────────┬────────┘
         │
         │ 3. Send via WebSocket
         │
┌────────▼────────┐
│  Socket.io      │
│    Server       │
│  (port 4000)    │
└────────┬────────┘
         │
         │ 4. Process audio
         │    (STT service)
         │
┌────────▼────────┐
│  Next.js API    │
│ /api/speech-    │
│  detection      │
└────────┬────────┘
         │
         │ 5. Store words
         │
┌────────▼────────┐
│ Global Session  │
│    Storage      │
└─────────────────┘
         │
         │ 6. Frontend polls
         │
┌────────▼────────┐
│  WordsDisplay   │
│   Component     │
└─────────────────┘
```

## Environment Variables

**`.env.local`**:
```env
NEXT_PUBLIC_API_URL=https://95366b075e24.ngrok-free.app/api
NEXT_PUBLIC_SOCKET_SERVER_URL=http://localhost:4000
```

For production, update `NEXT_PUBLIC_SOCKET_SERVER_URL` to your Socket server URL.

## Audio Format

- **Codec**: WebM with Opus (fallback to other formats)
- **Sample Rate**: 16kHz (standard for speech recognition)
- **Channels**: 1 (mono)
- **Bit Rate**: 16kbps
- **Chunk Interval**: 1 second

## Next Steps - Integrate Real Speech-to-Text

The server currently simulates word detection. To integrate real STT:

### Option 1: Google Cloud Speech-to-Text

```javascript
npm install @google-cloud/speech

// In socket-server.js:
const speech = require('@google-cloud/speech');
const client = new speech.SpeechClient();

async function processAudioChunk(audioBuffer, sessionId) {
  const audio = {
    content: audioBuffer.toString('base64'),
  };

  const config = {
    encoding: 'WEBM_OPUS',
    sampleRateHertz: 16000,
    languageCode: 'en-US',
  };

  const [response] = await client.recognize({ audio, config });
  const transcript = response.results[0]?.alternatives[0]?.transcript;

  if (transcript) {
    const words = transcript.split(' ');
    for (const word of words) {
      await axios.post(`${API_URL}/speech-detection`, {
        sessionId,
        word: word.trim(),
      });
    }
  }
}
```

### Option 2: Deepgram (Real-time)

```javascript
npm install @deepgram/sdk

const { Deepgram } = require('@deepgram/sdk');
const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

// Stream audio to Deepgram
const dgConnection = deepgram.transcription.live({
  punctuate: true,
  interim_results: false,
});

dgConnection.addListener('transcriptReceived', (transcript) => {
  const word = transcript.channel.alternatives[0].words[0]?.word;
  if (word) {
    axios.post(`${API_URL}/speech-detection`, {
      sessionId,
      word,
    });
  }
});
```

### Option 3: AssemblyAI

```javascript
npm install assemblyai

const { AssemblyAI } = require('assemblyai');
const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

// Real-time transcription
const transcriber = client.realtime.transcriber();

transcriber.on('transcript', (transcript) => {
  if (transcript.text) {
    axios.post(`${API_URL}/speech-detection`, {
      sessionId,
      word: transcript.text,
    });
  }
});
```

## Testing

Test the Socket.io server with curl or a Socket.io client:

```javascript
// Test client
const io = require('socket.io-client');
const socket = io('http://localhost:4000');

socket.on('connect', () => {
  console.log('Connected!');

  socket.emit('start-session', { sessionId: 'test-123' });

  // Simulate audio chunk
  socket.emit('audio-chunk', {
    sessionId: 'test-123',
    audioData: new Array(1000).fill(0),
    metadata: { size: 1000 }
  });
});

socket.on('chunk-received', (data) => {
  console.log('Chunk received:', data);
});
```

## Troubleshooting

### Microphone Permission Denied
- Check browser permissions
- Must be served over HTTPS or localhost

### Connection Failed
- Ensure Socket.io server is running on port 4000
- Check firewall settings
- Verify `NEXT_PUBLIC_SOCKET_SERVER_URL` is correct

### No Words Appearing
- Check Socket.io server console for logs
- Verify Next.js API is accessible
- Check browser console for errors

### Audio Quality Issues
- Try different audio formats
- Adjust sample rate
- Check microphone hardware

## Files Created/Modified

**New Files**:
- `server/socket-server.js` - Socket.io server
- `server/README.md` - Server documentation
- `src/lib/socket-client.ts` - Client-side Socket handler
- `src/components/AudioRecorder.tsx` - Audio recording UI

**Modified Files**:
- `src/app/speech/page.tsx` - Added AudioRecorder
- `src/app/globals.css` - Added audio recorder styles
- `package.json` - Added Socket.io dependencies and scripts
- `.env.local` - Added Socket server URL
- `.env.example` - Added Socket server URL

## Current Status

✅ Socket.io server running on port 4000
✅ AudioRecorder component integrated
✅ Real-time audio streaming working
⏳ Speech-to-text integration (simulated - needs real STT service)
✅ Words display in real-time

The system is ready for you to integrate your preferred speech-to-text service!
