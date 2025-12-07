import axios from 'axios';
import { SpeechDetectionRequest } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '1',
  },
});

export const api = {
  users: {
    getAll: () => apiClient.get('/users'),
    getById: (id: number) => apiClient.get(`/users/${id}`),
    create: (data: { name: string; email: string }) =>
      apiClient.post('/users', data),
    update: (id: number, data: Partial<{ name: string; email: string }>) =>
      apiClient.put(`/users/${id}`, data),
    delete: (id: number) => apiClient.delete(`/users/${id}`),
  },
  speechDetection: {
    create: (data: SpeechDetectionRequest) =>
      apiClient.post('/speech-detection', data),
    getSession: (sessionId: string) =>
      apiClient.get(`/speech-detection?sessionId=${sessionId}`),
    getAllSessions: () => apiClient.get('/speech-detection'),
    deleteSession: (sessionId: string) =>
      apiClient.delete(`/speech-detection?sessionId=${sessionId}`),
  },
  health: {
    check: () => apiClient.get('/health'),
  },
};
