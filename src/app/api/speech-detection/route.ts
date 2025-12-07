import { NextRequest, NextResponse } from 'next/server';

interface SpeechWord {
  word: string;
  timestamp: number;
}

interface SpeechSession {
  sessionId: string;
  words: SpeechWord[];
  createdAt: Date;
  updatedAt: Date;
}

// Global storage for speech sessions
const globalSpeechSession: Record<string, SpeechSession> = {};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, word } = body;

    // Validate required fields
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!word) {
      return NextResponse.json(
        { success: false, error: 'word is required' },
        { status: 400 }
      );
    }

    // Check if session exists
    const isNewSession = !globalSpeechSession[sessionId];

    if (isNewSession) {
      // Create new session with words array
      globalSpeechSession[sessionId] = {
        sessionId,
        words: [
          {
            word,
            timestamp: Date.now(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      // Push new word to existing session
      globalSpeechSession[sessionId].words.push({
        word,
        timestamp: Date.now(),
      });
      globalSpeechSession[sessionId].updatedAt = new Date();
    }

    return NextResponse.json(
      {
        success: true,
        message: isNewSession
          ? 'Session created successfully'
          : 'Word added to session',
        data: {
          sessionId,
          word,
          wordsCount: globalSpeechSession[sessionId].words.length,
          words: globalSpeechSession[sessionId].words,
          isNewSession,
        },
      },
      { status: isNewSession ? 201 : 200 }
    );
  } catch (error) {
    console.error('Speech detection error:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

// GET endpoint to retrieve a session
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    // Return all sessions if no sessionId provided
    return NextResponse.json({
      success: true,
      data: {
        sessions: Object.keys(globalSpeechSession),
        count: Object.keys(globalSpeechSession).length,
      },
    });
  }

  const session = globalSpeechSession[sessionId];

  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Session not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: session,
  });
}

// DELETE endpoint to clear a session
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { success: false, error: 'sessionId is required' },
      { status: 400 }
    );
  }

  if (!globalSpeechSession[sessionId]) {
    return NextResponse.json(
      { success: false, error: 'Session not found' },
      { status: 404 }
    );
  }

  delete globalSpeechSession[sessionId];

  return NextResponse.json({
    success: true,
    message: 'Session deleted successfully',
  });
}
