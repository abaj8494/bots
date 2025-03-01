import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth API
export const register = async (username: string, email: string, password: string) => {
  const response = await api.post('/auth/register', { username, email, password });
  return response.data;
};

export const login = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const saveApiKey = async (apiKey: string) => {
  const response = await api.post('/auth/apikey', { apiKey });
  return response.data;
};

export const checkApiKey = async () => {
  const response = await api.get('/auth/apikey');
  return response.data;
};

// Books API
export const getBooks = async () => {
  const response = await api.get('/books');
  return response.data;
};

export const getBook = async (id: number) => {
  const response = await api.get(`/books/${id}`);
  return response.data;
};

// Chat API
export const sendMessage = async (bookId: number, message: string) => {
  const response = await api.post(`/chat/${bookId}`, { message });
  return response.data;
};

export const getChatHistory = async (bookId: number) => {
  const response = await api.get(`/chat/${bookId}`);
  return response.data;
};

export const clearChatHistory = async (bookId: number) => {
  const response = await api.delete(`/chat/${bookId}`);
  return response.data;
};

export default api; 