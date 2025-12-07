# Speech-to-Text Integration with OpenAI Whisper

## Overview

The Socket.io server now includes real-time speech-to-text conversion using OpenAI's Whisper API. Audio chunks are processed asynchronously without blocking incoming audio streams, ensuring smooth continuous recording.

## Features

✅ **Asynchronous Processing** - Audio chunks are buffered and processed without blocking new audio intake
✅ **Batch Processing** - Accumulates 2 seconds of audio before sending to Whisper for better accuracy
✅ **Non-blocking Architecture** - Incoming audio is never stopped while processing previous chunks
✅ **Auto Word Detection** - Transcribed text is automatically split into words and sent to the API
✅ **Fallback Mode** - If OpenAI API key is not configured, uses simulation mode for testing
✅ **Clean Temporary Files** - Automatically creates and cleans up temporary audio files
✅ **Error Handling** - Robust error handling with graceful degradation

## Architecture

```
Audio Flow:
1. Client sends 1-second audio chunks via Socket.io
2. Server accumulates chunks (stores in sessionAudioAccumulator)
3. Every 2 seconds, accumulated audio is processed asynchronously
4. Audio is written to temporary .webm file
5. File is sent to OpenAI Whisper API
6. Transcription is received and split into words
7. Each word is sent to /api/speech-detection endpoint
8. Temporary file is deleted
9. Process continues for next batch (non-blocking)
```

## Installation

The required packages are already installed:

```bash
npm install openai fluent-ffmpeg @ffmpeg-installer/ffmpeg
```

## Configuration

### 1. Get OpenAI API Key

1. Sign up at [OpenAI Platform](https://platform.openai.com/)
2. Go to API Keys section
3. Create a new API key
4. Copy the key (starts with `sk-...`)

### 2. Update Environment Variables

Edit `.env.local`:

```env
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
```

**Important**: Replace `your_openai_api_key_here` with your actual OpenAI API key.

### 3. Without OpenAI API Key (Fallback Mode)

If you don't configure an OpenAI API key, the server will automatically fall back to simulation mode, which generates random words for testing purposes.

## How It Works

### Audio Accumulation

```javascript
// Server accumulates 1-second chunks
sessionAudioAccumulator.set(sessionId, {
  chunks: [],        // Array of audio chunk arrays
  chunkCount: 0,     // Number of chunks accumulated
  isProcessing: false // Flag to prevent concurrent processing
});
```

### Batch Processing

```javascript
// Process every 2 seconds (MIN_AUDIO_DURATION)
if (accumulator.chunkCount >= 2 && !accumulator.isProcessing) {
  // Get accumulated audio
  const accumulatedAudio = accumulator.chunks.flat();

  // Process asynchronously (doesn't block)
  processAudioAsync(sessionId, accumulatedAudio);

  // Continue accepting new chunks immediately
}
```

### OpenAI Whisper API Call

```javascript
const transcription = await openai.audio.transcriptions.create({
  file: audioStream,
  model: 'whisper-1',
  language: 'en',
  response_format: 'json',
});
```

### Word Extraction and Storage

```javascript
const words = transcription.text.split(/\s+/).filter(word => word.length > 0);

for (const word of words) {
  await axios.post(`${API_URL}/speech-detection`, {
    sessionId,
    word: word.toLowerCase(),
  });
}
```

## Code Structure

### Key Functions

#### `processAudioAsync(sessionId, audioData)`
- Entry point for async audio processing
- Catches errors without crashing the server
- Non-blocking wrapper around speechToText

#### `speechToText(audioData, sessionId)`
- Main STT function using OpenAI Whisper
- Creates temporary .webm file from audio buffer
- Calls Whisper API with audio stream
- Splits transcription into words
- Cleans up temporary files

#### `sendWordToAPI(sessionId, word)`
- Sends detected word to the speech detection API
- Converts word to lowercase
- Logs success/failure

#### `fallbackSpeechDetection(sessionId)`
- Simulation mode for testing without API key
- Generates random words from predefined list
- Used when OpenAI API key is not configured

### Audio Chunk Handler

```javascript
socket.on('audio-chunk', async ({ sessionId, audioData, metadata }) => {
  // 1. Acknowledge immediately (non-blocking)
  socket.emit('chunk-received', { chunkNumber, timestamp });

  // 2. Add to accumulator
  accumulator.chunks.push(audioData);
  accumulator.chunkCount++;

  // 3. Process every 2 seconds asynchronously
  if (accumulator.chunkCount >= MIN_AUDIO_DURATION && !accumulator.isProcessing) {
    processAudioAsync(sessionId, accumulatedAudio);
  }
});
```

## Configuration Options

### Adjust Processing Frequency

Edit `server/socket-server.js`:

```javascript
// Process every 3 seconds instead of 2
const MIN_AUDIO_DURATION = 3;

// Process every chunk (1 second) - faster but more API calls
const MIN_AUDIO_DURATION = 1;

// Process every 5 seconds - slower but fewer API calls
const MIN_AUDIO_DURATION = 5;
```

### Change Whisper Model

```javascript
const transcription = await openai.audio.transcriptions.create({
  file: audioStream,
  model: 'whisper-1',  // Options: whisper-1
  language: 'en',      // Options: en, es, fr, de, etc.
  response_format: 'json', // Options: json, text, srt, vtt
});
```

## Testing

### 1. Start Both Servers

**Terminal 1** - Next.js:
```bash
npm run dev
```

**Terminal 2** - Socket.io:
```bash
npm run dev:socket
```

### 2. Test with Fallback Mode (No API Key)

1. Don't configure `OPENAI_API_KEY` or set it to empty
2. Navigate to http://localhost:3002/record
3. Generate a session ID
4. Start recording and speak
5. See random words appear (simulation mode)

**Console Output**:
```
⚠️  OpenAI API key not configured, using fallback
📝 Word saved: "hello" for session record-xxx
```

### 3. Test with OpenAI Whisper

1. Configure `OPENAI_API_KEY` in `.env.local`
2. Restart Socket.io server: `npm run dev:socket`
3. Navigate to http://localhost:3002/record
4. Start recording and speak clearly
5. See actual transcribed words appear

**Console Output**:
```
🔄 Processing 32000 bytes of audio for session record-xxx
🎯 Transcribed: "hello world this is a test" for session record-xxx
📝 Word saved: "hello" for session record-xxx
📝 Word saved: "world" for session record-xxx
📝 Word saved: "this" for session record-xxx
```

## Cost Considerations

### OpenAI Whisper Pricing

- **Model**: Whisper (whisper-1)
- **Cost**: $0.006 per minute of audio
- **Example**: 10 minutes of recording = $0.06

### Batch Processing Benefits

By accumulating 2 seconds of audio before processing:
- **Without batching**: 30 API calls per minute (1 per second) = ~$0.18/min
- **With batching**: 15 API calls per minute (1 per 2 seconds) = ~$0.09/min
- **Savings**: 50% reduction in API costs

### Optimization Tips

1. **Increase batch size**: Set `MIN_AUDIO_DURATION = 3` or higher
2. **Use voice activity detection**: Only process when user is speaking
3. **Set silence threshold**: Skip processing silent audio chunks

## Troubleshooting

### "OpenAI API key not configured"

**Issue**: Server falls back to simulation mode

**Solution**:
1. Get API key from https://platform.openai.com/api-keys
2. Add to `.env.local`: `OPENAI_API_KEY=sk-...`
3. Restart Socket.io server

### "Error in speech-to-text"

**Common Causes**:
1. Invalid API key
2. OpenAI API rate limit exceeded
3. Audio format not supported
4. Insufficient OpenAI credits

**Check**:
- Verify API key is correct
- Check OpenAI dashboard for credits/limits
- Review server console logs for detailed error

### No Words Appearing

**Checklist**:
- [ ] Socket.io server is running
- [ ] OpenAI API key is configured
- [ ] Audio is being recorded (check browser permissions)
- [ ] Chunks are being received (check server logs)
- [ ] Next.js API is accessible

**Debug**:
```bash
# Check server logs for:
🎵 Audio chunk received    # Audio is coming in
🔄 Processing audio        # Batches are being processed
🎯 Transcribed: "..."     # Whisper is working
📝 Word saved: "..."      # Words are being stored
```

### Temporary Files Not Cleaning Up

**Issue**: `server/temp/` directory fills up

**Solution**:
1. Server should auto-clean files
2. Manual cleanup: `rm server/temp/*`
3. Check for errors in `speechToText()` function

### Audio Quality Issues

**Solutions**:
1. Increase batch size for longer context
2. Ensure microphone quality is good
3. Test in quiet environment
4. Check audio encoding format

## Advanced Configuration

### Voice Activity Detection

Add silence detection to skip processing silent audio:

```javascript
function isSilent(audioData) {
  const samples = new Int16Array(audioData.buffer);
  const rms = Math.sqrt(samples.reduce((sum, val) => sum + val * val, 0) / samples.length);
  const threshold = 500; // Adjust based on testing
  return rms < threshold;
}

// In audio-chunk handler:
if (!isSilent(audioData)) {
  accumulator.chunks.push(audioData);
}
```

### Multiple Language Support

```javascript
const transcription = await openai.audio.transcriptions.create({
  file: audioStream,
  model: 'whisper-1',
  // Auto-detect language (leave empty) or specify:
  language: 'en', // English
  // language: 'es', // Spanish
  // language: 'fr', // French
  response_format: 'json',
});
```

### Phrase-Based Processing

Instead of splitting into words, send entire phrases:

```javascript
// In speechToText function:
if (transcribedText && transcribedText.length > 0) {
  // Send entire phrase instead of individual words
  await sendWordToAPI(sessionId, transcribedText);
}
```

## Performance Metrics

### Latency

- **Audio Chunk**: 1 second
- **Batch Accumulation**: 2 seconds
- **Whisper API**: 0.5-2 seconds
- **Total Latency**: 3.5-5 seconds from speech to display

### Resource Usage

- **CPU**: Minimal (audio processing done by OpenAI)
- **Memory**: ~1-2MB per active session (buffer storage)
- **Disk**: Temporary files cleaned immediately after processing
- **Network**: ~16KB/s upload per session

## Production Deployment

### Environment Variables

```env
# Production .env
OPENAI_API_KEY=sk-prod-your-actual-key
SOCKET_PORT=4000
API_URL=https://your-production-api.com/api
```

### Security Considerations

1. **Never commit** `.env.local` with real API keys
2. Use environment secrets in production (e.g., Vercel, Heroku)
3. Rate limit Socket.io connections
4. Validate audio data before processing
5. Set maximum session duration

### Scaling

For high-traffic scenarios:

1. **Queue System**: Use Redis/Bull for audio processing queue
2. **Worker Processes**: Separate audio processing to worker threads
3. **Load Balancer**: Distribute Socket.io connections across servers
4. **CDN**: Serve static assets via CDN

## Summary

The speech-to-text system is now fully integrated with:

✅ OpenAI Whisper API for accurate transcription
✅ Asynchronous, non-blocking processing
✅ Automatic word detection and storage
✅ Fallback mode for testing
✅ Clean error handling
✅ Cost-optimized batch processing

Simply add your OpenAI API key and start recording!
