import axios from 'axios';

// Only use environment variables for API URL without fallbacks to hardcoded values
const API_URL = process.env.REACT_APP_API_URL || '';

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
  const response = await api.post('/api/auth/login', { email, password });
  return response.data;
};

export const register = async (username: string, email: string, password: string) => {
  const response = await api.post('/api/auth/register', { username, email, password });
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get('/api/auth/me');
  return response.data;
};

export const checkApiKey = async () => {
  const response = await api.get('/api/auth/apikey');
  return response.data;
};

export const saveApiKey = async (apiKey: string) => {
  const response = await api.post('/api/auth/apikey', { apiKey });
  return response.data;
};

// Book services
export const getBooks = async () => {
  console.log('API Service: Making request to /api/books');
  try {
    const response = await api.get('/api/books');
    console.log('API Service: Successfully received books response:', response);
    return response.data;
  } catch (error) {
    console.error('API Service: Error fetching books:', error);
    throw error;
  }
};

export const getBook = async (id: number) => {
  const response = await api.get(`/api/books/${id}`);
  return response.data;
};

// Chat services
export const sendChatMessage = async (bookId: number, message: string, chatHistory: any[] = []) => {
  console.log('Sending chat message to book ID:', bookId);
  console.log('Current auth token:', localStorage.getItem('token')?.substring(0, 20) + '...');
  
  // Ensure the token is in the headers
  const token = localStorage.getItem('token');
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await api.post(`/api/chat/${bookId}`, { message, chatHistory });
    console.log('Chat message response:', response);
    return response.data;
  } catch (error) {
    console.error('Error in sendChatMessage:', error);
    throw error;
  }
};

export const getChatHistory = async (bookId: number) => {
  const response = await api.get(`/api/chat/${bookId}`);
  return response.data;
};

export const clearChatHistory = async (bookId: number) => {
  const response = await api.delete(`/api/chat/${bookId}`);
  return response.data;
};

// New function to track embedding progress
export const trackEmbeddingProgress = (
  bookId: number, 
  onProgress: (processedChunks: number, totalChunks: number) => void,
  onError: (error: Error) => void
): () => void => {
  // Get token for authorization
  const token = localStorage.getItem('token');
  if (!token) {
    onError(new Error('Authentication token not found'));
    return () => {}; // Return empty cleanup function
  }
  
  console.log(`Setting up EventSource for book ID: ${bookId}`);
  
  // Create EventSource for SSE connection
  // Note: EventSource doesn't support custom headers directly
  // We'll need to use a workaround or handle auth on the server differently
  const eventSourceUrl = `${API_URL}/api/chat/progress/${bookId}?token=${encodeURIComponent(token)}`;
  console.log(`EventSource URL: ${eventSourceUrl}`);
  
  const eventSource = new EventSource(
    eventSourceUrl,
    { withCredentials: true }
  );
  
  // Set up event handlers
  eventSource.onopen = () => {
    console.log('SSE Connection opened successfully');
  };
  
  eventSource.onmessage = (event) => {
    try {
      console.log('Progress update received:', event.data);
      const data = JSON.parse(event.data);
      console.log(`Progress: ${data.processedChunks}/${data.totalChunks}`);
      onProgress(data.processedChunks, data.totalChunks);
      
      // If processing is complete, close the connection
      if (data.processedChunks === data.totalChunks && data.totalChunks > 0) {
        console.log('Processing complete - closing SSE connection');
        eventSource.close();
      }
    } catch (error) {
      console.error('Error parsing progress data:', error);
    }
  };
  
  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    onError(new Error('Error connecting to progress updates'));
    eventSource.close();
  };
  
  // Return a cleanup function
  return () => {
    console.log('Cleaning up SSE connection');
    eventSource.close();
  };
};

export default api; 