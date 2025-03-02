import axios from 'axios';

// Use environment variable if available, otherwise default to production URL
const API_URL = process.env.REACT_APP_API_URL || 'https://api.abaj.cloud/api';

// Set up axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests if it exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Authentication services
export const login = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const register = async (username: string, email: string, password: string) => {
  const response = await api.post('/auth/register', { username, email, password });
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const checkApiKey = async () => {
  const response = await api.get('/auth/apikey');
  return response.data;
};

export const saveApiKey = async (apiKey: string) => {
  const response = await api.post('/auth/apikey', { apiKey });
  return response.data;
};

// Book services
export const getBooks = async () => {
  const response = await api.get('/books');
  return response.data;
};

export const getBook = async (id: number) => {
  const response = await api.get(`/books/${id}`);
  return response.data;
};

// Chat services
export const sendChatMessage = async (bookId: number, message: string, chatHistory: any[] = []) => {
  const response = await api.post(`/chat/${bookId}`, { message, chatHistory });
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