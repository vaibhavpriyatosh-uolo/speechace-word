# Deployment Setup Guide

## Architecture Overview

This application has two services that work together:

1. **Next.js App** (Port 3000) - Frontend + API Routes
2. **Socket.io Server** (Port 3001) - Real-time audio processing

## Socket Proxy Configuration

The Next.js app proxies Socket.io requests from `/socket.io/*` to the Socket server on port 3001.

### How it works:

- Frontend connects to: `http://localhost:3000/socket.io` (or just empty string `''`)
- Next.js rewrites to: `http://localhost:3001/socket.io`
- Socket server runs on port 3001

This allows:
- ✅ Single domain for frontend and WebSocket
- ✅ No CORS issues
- ✅ Easy deployment (both services behind one domain)

## Running Locally

### Terminal 1: Socket Server
```bash
npm run dev:socket
```
Socket server will start on **port 3001**

### Terminal 2: Next.js App
```bash
npm run dev
```
Next.js will start on **port 3000**

### Access the app:
- Frontend: http://localhost:3000
- Socket.io: http://localhost:3000/socket.io (proxied to :3001)
- API: http://localhost:3000/api

## Environment Variables

### `.env.local` (for local development)

```env
# Next.js Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_SOCKET_SERVER_URL=

# Socket Server (backend)
SOCKET_PORT=3001
API_URL=http://localhost:3000/api
SOCKET_SERVER_URL=http://localhost:3001

# OpenAI
OPENAI_API_KEY=your_key_here
```

### Production Environment Variables

**For Vercel (Next.js):**
```env
NEXT_PUBLIC_API_URL=https://your-app.vercel.app/api
NEXT_PUBLIC_SOCKET_SERVER_URL=
SOCKET_SERVER_URL=https://your-socket-server.railway.app
```

**For Railway (Socket Server):**
```env
NODE_ENV=production
PORT=3001
SOCKET_PORT=3001
API_URL=https://your-app.vercel.app/api
OPENAI_API_KEY=your_key_here
FRONTEND_URL=https://your-app.vercel.app
```

## Deployment

### Option 1: Vercel + Railway (Recommended)

**Vercel (Next.js):**
1. Connect GitHub repo to Vercel
2. Set environment variables
3. Deploy

**Railway (Socket Server):**
1. Create new project from GitHub
2. Set root directory to `/server` or use start command: `node server/socket-server.js`
3. Set environment variables
4. Deploy

### Option 2: All on Railway

Deploy two services from same repo:
- Service 1: Next.js (root directory)
- Service 2: Socket Server (`/server` directory)

## Port Configuration

| Service | Development | Production |
|---------|-------------|------------|
| Next.js | 3000 | Auto (Vercel) |
| Socket Server | 3001 | Auto (Railway) |

## How Socket Proxy Works

```
User Browser → http://localhost:3000/socket.io
              ↓ (Next.js rewrites)
              http://localhost:3001/socket.io → Socket Server
```

In production:
```
User Browser → https://your-app.vercel.app/socket.io
              ↓ (Next.js rewrites)
              https://socket-server.railway.app/socket.io → Socket Server
```

## Testing the Setup

1. Start both servers
2. Open http://localhost:3000/speech
3. Select or create a session
4. Click "Start Recording"
5. Check browser console for Socket.io connection
6. Speak into microphone
7. Words should appear in real-time

## Troubleshooting

### Socket not connecting:
- Check socket server is running on port 3001
- Check `.env.local` has correct `SOCKET_SERVER_URL`
- Check `next.config.js` has correct rewrite destination

### CORS errors:
- Socket server CORS is configured for production/development
- In development, allows all origins (`*`)
- In production, only allows configured frontend URL

### Port already in use:
```bash
# Find process on port 3001
lsof -ti:3001 | xargs kill
```

## Notes

- Empty `NEXT_PUBLIC_SOCKET_SERVER_URL` means use relative path (proxied)
- Socket server still needs full URL in `SOCKET_SERVER_URL` for `next.config.js` rewrites
- Both services can run on same machine or separately
