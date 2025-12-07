# Simple Audio Recorder - 1-Second Chunks

## Overview

A streamlined audio recorder component that captures audio from the microphone and sends 1-second chunks to the Socket.io server in real-time.

## Features

✅ **1-Second Audio Chunks** - Automatically splits audio into 1-second segments
✅ **Real-time Streaming** - Sends chunks immediately as they're captured
✅ **Audio Visualization** - Live audio level meter
✅ **Connection Status** - Visual indicator for server connection
✅ **Chunk Counter** - Shows how many chunks have been sent
✅ **Beautiful UI** - Gradient design with smooth animations
✅ **Error Handling** - User-friendly error messages

## Component: SimpleAudioRecorder

**Location**: `src/components/SimpleAudioRecorder.tsx`

### How It Works

1. **Connect to Socket.io Server**
   - Automatically connects when component mounts
   - Shows connection status (🟢 Connected / 🔴 Disconnected)

2. **Start Recording**
   - Requests microphone permission
   - Captures audio at 16kHz mono (optimized for speech)
   - Starts MediaRecorder with 1-second time slices

3. **Send Chunks**
   - Every 1 second, MediaRecorder fires `ondataavailable`
   - Blob is converted to ArrayBuffer
   - Sent to Socket.io server via `audio-chunk` event
   - Server acknowledges receipt

4. **Audio Visualization**
   - Real-time audio level meter
   - Shows percentage (0-100%)
   - Animated gradient bar

5. **Stop Recording**
   - Stops MediaRecorder
   - Closes audio stream
   - Notifies server

## Audio Specifications

- **Format**: WebM with Opus codec (fallback to other formats)
- **Sample Rate**: 16kHz (standard for speech recognition)
- **Channels**: Mono (1 channel)
- **Bit Rate**: 16kbps
- **Chunk Duration**: 1 second (1000ms)
- **Features**: Echo cancellation, Noise suppression, Auto gain control

## Usage

```tsx
import SimpleAudioRecorder from '@/components/SimpleAudioRecorder';

<SimpleAudioRecorder
  sessionId="session-123"
  serverUrl="http://localhost:4000"
/>
```

### Props

- `sessionId` (string): Unique identifier for the recording session
- `serverUrl` (string): URL of the Socket.io server

## Socket.io Events

### Emitted by Client

```javascript
// Start session
socket.emit('start-session', {
  sessionId: 'session-123'
});

// Send audio chunk (every 1 second)
socket.emit('audio-chunk', {
  sessionId: 'session-123',
  audioData: [/* Uint8Array as array */],
  metadata: {
    mimeType: 'audio/webm;codecs=opus',
    size: 16000,
    timestamp: 1234567890000
  }
});

// Stop session
socket.emit('stop-session', {
  sessionId: 'session-123'
});
```

### Received by Client

```javascript
// Session started confirmation
socket.on('session-started', (data) => {
  // { sessionId, timestamp }
});

// Chunk received confirmation
socket.on('chunk-received', (data) => {
  // { chunkNumber, timestamp }
});

// Session stopped confirmation
socket.on('session-stopped', (data) => {
  // { sessionId, chunksReceived, duration }
});
```

## Server-Side Processing

The Socket.io server ([server/socket-server.js](server/socket-server.js)) receives chunks and can process them:

```javascript
socket.on('audio-chunk', async ({ sessionId, audioData, metadata }) => {
  // Convert array back to Uint8Array
  const uint8Array = new Uint8Array(audioData);

  // Process audio chunk
  // - Send to speech-to-text API
  // - Convert format if needed
  // - Store for later processing
  // - Etc.

  // Example: Send to speech detection API
  const word = await speechToText(uint8Array);
  await axios.post('/api/speech-detection', {
    sessionId,
    word
  });
});
```

## UI Design

The component features a beautiful gradient design:

- **Background**: Purple gradient (#667eea → #764ba2)
- **Buttons**: Gradient buttons with hover effects
  - Start: Green gradient (#11998e → #38ef7d)
  - Stop: Red gradient (#ee0979 → #ff6a00)
- **Visualizer**: Animated audio level bar
- **Status**: Connection badge with color coding
- **Pulse**: Recording indicator with animation

## Browser Compatibility

- Chrome 49+
- Firefox 25+
- Safari 11+
- Edge 79+

**Requirements**:
- HTTPS or localhost (for microphone access)
- MediaRecorder API support
- Web Audio API support

## Testing

### 1. Start Servers

**Terminal 1** - Next.js:
```bash
npm run dev
```

**Terminal 2** - Socket.io:
```bash
npm run dev:socket
```

### 2. Open Browser

Navigate to: http://localhost:3001/speech

### 3. Test Recording

1. Select or create a session
2. SimpleAudioRecorder appears
3. Click "Start Recording"
4. Allow microphone permission
5. Speak into microphone
6. Watch chunks counter increase
7. See audio level visualizer
8. Words appear in session below
9. Click "Stop Recording"

### 4. Monitor Server

Watch Socket.io server console for:
```
✅ Client connected: xyz123
🎤 Session started: session-123
🎵 Audio chunk received for session: session-123 (chunk #1)
📝 Word detected and saved: "hello" for session session-123
```

## Troubleshooting

### "Microphone permission denied"
- Click padlock/info icon in browser address bar
- Allow microphone access
- Refresh page

### "No microphone found"
- Check system settings
- Verify microphone is connected
- Try different browser

### "Failed to connect to server"
- Verify Socket.io server is running on port 4000
- Check `NEXT_PUBLIC_SOCKET_SERVER_URL` in `.env.local`
- Check browser console for errors

### No chunks being sent
- Check browser console for errors
- Verify Socket.io server is receiving connections
- Check network tab in developer tools

### No words appearing
- Server simulates words every 3 chunks
- Check Socket.io server console for errors
- Verify Next.js API is accessible

## Performance

- **Chunk Size**: ~16KB per second (16kHz * 1 byte * 1 second)
- **Network**: ~16KB/s upload bandwidth
- **CPU**: Minimal (MediaRecorder handles encoding)
- **Memory**: Low (chunks sent immediately)

## Next Steps

### Integrate Real Speech-to-Text

Replace the simulated word detection in `server/socket-server.js`:

```javascript
// Instead of simulateWordDetection(), use:

const { SpeechClient } = require('@google-cloud/speech');
const client = new SpeechClient();

socket.on('audio-chunk', async ({ sessionId, audioData, metadata }) => {
  const uint8Array = new Uint8Array(audioData);

  const [response] = await client.recognize({
    audio: { content: uint8Array.toString('base64') },
    config: {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 16000,
      languageCode: 'en-US',
    },
  });

  const transcript = response.results[0]?.alternatives[0]?.transcript;
  if (transcript) {
    await axios.post(`${API_URL}/speech-detection`, {
      sessionId,
      word: transcript.trim(),
    });
  }
});
```

## Comparison: Simple vs Original

| Feature | SimpleAudioRecorder | AudioRecorder |
|---------|---------------------|---------------|
| Setup | All-in-one component | Separate Socket client |
| Code | ~250 lines | ~400+ lines |
| Dependencies | Socket.io-client | Socket.io-client |
| Visualization | Yes | No |
| UI Design | Gradient, modern | Basic |
| Auto-connect | Yes | Manual |
| Chunk Size | 1 second | 1 second |

## Files

**New Files**:
- `src/components/SimpleAudioRecorder.tsx` - Main component
- `SIMPLE_AUDIO_RECORDER.md` - This documentation

**Modified Files**:
- `src/app/speech/page.tsx` - Uses SimpleAudioRecorder
- `src/app/globals.css` - Added styles

**Existing Files** (still used):
- `server/socket-server.js` - Socket.io server
- `.env.local` - Configuration

## Summary

The SimpleAudioRecorder provides a complete, production-ready solution for capturing and streaming audio in 1-second chunks to your backend. It's user-friendly, visually appealing, and includes all necessary features for speech recognition applications.

Simply select a session, click "Start Recording", and speak - audio is automatically captured and sent to your server for processing!
