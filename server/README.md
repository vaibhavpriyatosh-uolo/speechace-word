# WebRTC Socket Server

This is a Socket.io server for handling real-time audio streaming for speech detection.

## Running the Server

Start the Socket.io server:

```bash
npm run dev:socket
```

The server will run on port 4000 by default.

## Environment Variables

Set these in your terminal or create a `.env` file in the server directory:

- `SOCKET_PORT` - Port for Socket.io server (default: 4000)
- `API_URL` - URL of the Next.js API (default: http://localhost:3001/api)

## How It Works

1. Client connects to Socket.io server
2. Client starts a session with a `sessionId`
3. Client captures audio from microphone and sends chunks
4. Server receives audio chunks and processes them
5. Server sends detected words to `/api/speech-detection` endpoint
6. Frontend polls the endpoint and displays words in real-time

## Socket Events

### Client → Server

- `start-session` - Start a new audio session
  ```javascript
  socket.emit('start-session', { sessionId: 'session-123' });
  ```

- `audio-chunk` - Send audio data
  ```javascript
  socket.emit('audio-chunk', {
    sessionId: 'session-123',
    audioData: arrayBuffer,
    metadata: { mimeType, size, duration }
  });
  ```

- `stop-session` - Stop audio session
  ```javascript
  socket.emit('stop-session', { sessionId: 'session-123' });
  ```

### Server → Client

- `session-started` - Acknowledgment of session start
- `chunk-received` - Acknowledgment of audio chunk
- `session-stopped` - Acknowledgment of session stop
- `error` - Error message

## Audio Processing

Currently, the server has a simulated word detection function that randomly generates words every 3 chunks for testing.

To integrate with a real speech-to-text service:

1. Replace the `simulateWordDetection` function in `socket-server.js`
2. Add your STT API credentials
3. Process audio chunks and extract text
4. Send results to the Next.js API

## Supported STT Services

- Google Cloud Speech-to-Text
- AWS Transcribe
- Azure Speech Service
- Deepgram
- AssemblyAI

Example integration (Google Cloud):

```javascript
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

  for (const result of response.results) {
    const transcript = result.alternatives[0].transcript;
    const words = transcript.split(' ');

    for (const word of words) {
      await axios.post(`${API_URL}/speech-detection`, {
        sessionId,
        word,
      });
    }
  }
}
```

## Running Both Servers

To run both the Next.js server and Socket.io server:

**Terminal 1:**
```bash
npm run dev
```

**Terminal 2:**
```bash
npm run dev:socket
```

Or use a process manager like `pm2` or `concurrently`:

```bash
npm install -g concurrently
# Then update package.json:
"dev:all": "concurrently \"npm run dev\" \"npm run dev:socket\""
```
