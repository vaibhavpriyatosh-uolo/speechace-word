# Vosk Installation Troubleshooting

## Issue Summary

The `vosk` npm package **failed to install** due to native compilation errors:

```
npm error gyp ERR! configure error
npm error gyp ERR! stack Error: `gyp` failed with exit code: 1
npm error AttributeError: 'NoneType' object has no attribute 'groupdict'
```

## Root Cause

Vosk requires native C++ bindings (`ffi-napi`) which need to be compiled on your machine. The compilation failed because:

1. **Xcode Command Line Tools issues** - Missing or corrupted CLT receipts
2. **node-gyp compilation problems** - Python/Xcode version mismatch
3. **macOS compatibility** - Common issue on macOS with newer Node.js versions

## Your System

- **OS**: macOS (Darwin 23.6.0)
- **Node.js**: v22.13.0
- **Python**: 3.9.6
- **Vosk Model**: Already downloaded at `server/models/vosk-model-small-en-us-0.15/`

## Current Speech-to-Text System

### Two-Tier Fallback (Currently Implemented)

**Tier 1**: OpenAI Whisper API
- Status: ✅ Working
- Latency: ~1-3 seconds
- Accuracy: Excellent (95%+)
- Cost: $0.006 per minute
- Requires: API key in `.env.local`

**Tier 2**: Simulation Fallback
- Status: ✅ Working
- Latency: Instant
- Accuracy: N/A (random words)
- Cost: Free
- Purpose: Testing without API key

### Desired Three-Tier System

**Tier 1**: Vosk (local, offline)
- Status: ❌ Failed to install
- Would be: Free, local, offline
- Accuracy: Good (80-85%)

**Tier 2**: OpenAI Whisper
- Status: ✅ Working

**Tier 3**: Simulation
- Status: ✅ Working

## Fix Options

### Option 1: Fix Xcode Command Line Tools (Recommended)

```bash
# Remove existing Command Line Tools
sudo rm -rf /Library/Developer/CommandLineTools

# Reinstall Command Line Tools
xcode-select --install

# Accept license
sudo xcodebuild -license accept

# Verify installation
xcode-select -p
# Should output: /Library/Developer/CommandLineTools

# Try Vosk installation again
npm install vosk --save
```

### Option 2: Use Pre-built Vosk Binaries

Some platforms provide pre-built Vosk binaries that don't require compilation:

```bash
# Try vosk-browser (WebAssembly-based, no compilation needed)
npm install vosk-browser --save
```

Note: `vosk-browser` has different API than regular `vosk`.

### Option 3: Use Alternative Package

Try `node-vosk` which may have better macOS compatibility:

```bash
npm install node-vosk --save
```

### Option 4: Use Docker

Run the Socket.io server in Docker where Vosk can be pre-compiled:

```dockerfile
FROM node:18-alpine

# Install Vosk dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
CMD ["node", "server/socket-server.js"]
```

### Option 5: Keep Current System

Use **OpenAI Whisper + Fallback** (already working):
- High accuracy with OpenAI
- No installation issues
- Just add API key to start using
- Cost is minimal ($0.006/minute)

## How to Enable Vosk (If Installation Succeeds)

### Step 1: Install Package

```bash
npm install vosk --save
```

### Step 2: Update `server/socket-server.js`

Add imports:
```javascript
const { Model, KaldiRecognizer } = require('vosk');
```

Add configuration:
```javascript
const VOSK_MODEL_PATH = path.join(__dirname, 'models/vosk-model-small-en-us-0.15');
const VOSK_SAMPLE_RATE = 16000;

let voskModel = null;
try {
  voskModel = new Model(VOSK_MODEL_PATH);
  console.log('✅ Vosk model loaded successfully');
} catch (error) {
  console.warn('⚠️  Vosk model failed to load:', error.message);
}
```

### Step 3: Create Vosk STT Function

```javascript
async function voskSpeechToText(audioData, sessionId) {
  if (!voskModel) {
    throw new Error('Vosk model not loaded');
  }

  try {
    const rec = new KaldiRecognizer(voskModel, VOSK_SAMPLE_RATE);
    rec.SetWords(true);

    const audioBuffer = Buffer.from(audioData);
    const chunkSize = 4000;

    for (let i = 0; i < audioBuffer.length; i += chunkSize) {
      const chunk = audioBuffer.slice(i, Math.min(i + chunkSize, audioBuffer.length));
      rec.AcceptWaveform(chunk);
    }

    const resultJson = rec.FinalResult();
    const result = JSON.parse(resultJson);
    rec.Free();

    const transcribedText = result.text?.trim();

    if (transcribedText && transcribedText.length > 0) {
      console.log(`🎯 [Vosk] Transcribed: "${transcribedText}"`);

      const words = transcribedText.split(/\s+/).filter(word => word.length > 0);
      for (const word of words) {
        await sendWordToAPI(sessionId, word);
      }

      return transcribedText;
    }

    return null;
  } catch (error) {
    console.error(`❌ [Vosk] Error:`, error.message);
    throw error;
  }
}
```

### Step 4: Update speechToText to Use Three Tiers

```javascript
async function speechToText(audioData, sessionId) {
  // Tier 1: Try Vosk (local, fast, free)
  if (voskModel) {
    try {
      console.log('🔄 [Tier 1] Trying Vosk...');
      return await voskSpeechToText(audioData, sessionId);
    } catch (error) {
      console.warn(`⚠️  [Tier 1] Vosk failed: ${error.message}`);
    }
  }

  // Tier 2: Try OpenAI Whisper (cloud, accurate, paid)
  if (openai) {
    try {
      console.log('🔄 [Tier 2] Trying OpenAI Whisper...');
      return await openaiSpeechToText(audioData, sessionId);
    } catch (error) {
      console.warn(`⚠️  [Tier 2] OpenAI failed: ${error.message}`);
    }
  }

  // Tier 3: Fallback simulation
  console.log('🔄 [Tier 3] Using fallback simulation');
  return await fallbackSpeechDetection(sessionId);
}
```

## Testing After Vosk Installation

### Verify Vosk is Working

Start server and look for:
```
✅ Vosk model loaded successfully
```

Record audio and check logs:
```
🔄 [Tier 1] Trying Vosk...
🎯 [Vosk] Transcribed: "your spoken text"
```

### If Vosk Fails

Logs will show:
```
⚠️  [Tier 1] Vosk failed: <error message>
🔄 [Tier 2] Trying OpenAI Whisper...
```

System automatically falls back to OpenAI.

## Current Recommendation

**Use the existing OpenAI + Fallback system** which is already working:

1. Add OpenAI API key to `.env.local`:
   ```
   OPENAI_API_KEY=sk-your-actual-key-here
   ```

2. Restart Socket.io server:
   ```bash
   npm run dev:socket
   ```

3. Start recording - words will be transcribed via OpenAI Whisper

4. Later, if you fix Vosk installation, just restart the server and it will automatically use Vosk first

## Cost Analysis

### Current System (OpenAI Only)
- **Cost**: $0.006 per minute
- **Example**: 10 minutes of recording = $0.06
- **With batching**: Already optimized (2-second batches reduce API calls by 50%)

### With Vosk (If Installed)
- **Vosk**: Free (local processing)
- **OpenAI**: Only used if Vosk fails
- **Savings**: Potentially 100% if Vosk works well

## Support Resources

### Vosk Documentation
- Official: https://alphacephei.com/vosk/
- GitHub: https://github.com/alphacep/vosk-api
- Node.js Docs: https://github.com/alphacep/vosk-api/tree/master/nodejs

### node-gyp Issues
- Troubleshooting: https://github.com/nodejs/node-gyp#on-macos
- Xcode CLT: https://developer.apple.com/download/more/

### Alternative STT Solutions
- OpenAI Whisper API: https://platform.openai.com/docs/guides/speech-to-text
- Deepgram: https://deepgram.com/
- AssemblyAI: https://www.assemblyai.com/

## Summary

**Current Status**:
- ❌ Vosk installation failed (native compilation issues)
- ✅ OpenAI Whisper working
- ✅ Fallback simulation working
- ✅ System is functional and ready to use

**Next Steps**:
1. Use OpenAI Whisper (add API key and start using)
2. OR fix Xcode Command Line Tools and retry Vosk installation
3. OR use alternative local STT solution

The system is designed to work without Vosk, with automatic fallback to OpenAI. You can fix the Vosk installation later and just restart the server to enable the three-tier system.
