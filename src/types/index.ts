export interface User {
  id: number;
  name: string;
  email: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SpeechWord {
  word: string;
  timestamp: number;
}

export interface SpeechSession {
  sessionId: string;
  words: SpeechWord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SpeechDetectionRequest {
  sessionId: string;
  word: string;
}
