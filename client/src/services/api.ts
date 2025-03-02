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
  const eventSourceUrl = `${API_URL}/api/chat/progress/${bookId}?token=${encodeURIComponent(token)}`;
  console.log(`EventSource URL: ${eventSourceUrl}`);
  
  let eventSource: EventSource;
  try {
    eventSource = new EventSource(
      eventSourceUrl,
      { withCredentials: true }
    );
  } catch (err) {
    console.error("Failed to create EventSource:", err);
    onError(new Error('Failed to initialize progress tracking'));
    return () => {};
  }
  
  // Flag to track if we've received at least one valid progress update
  let receivedValidProgress = false;
  // Flag to track if we're expecting the connection to close
  let expectingClose = false;
  // Last progress values for reconnection logic
  let lastProcessed = 0;
  let lastTotal = 0;
  
  // Set up event handlers
  eventSource.onopen = () => {
    console.log('SSE Connection opened successfully');
    // Reset error state if we successfully open a connection
    receivedValidProgress = false;
  };
  
  eventSource.onmessage = (event) => {
    try {
      console.log('Progress update received:', event.data);
      const data = JSON.parse(event.data);
      
      // Validate data format
      if (data && typeof data.processedChunks === 'number' && typeof data.totalChunks === 'number') {
        console.log(`Progress: ${data.processedChunks}/${data.totalChunks}`);
        
        // Store last values
        lastProcessed = data.processedChunks;
        lastTotal = data.totalChunks;
        
        // Set receivedValidProgress to true when we get actual progress data
        if (data.totalChunks > 0) {
          receivedValidProgress = true;
        }
        
        // Call the onProgress callback with the current progress
        onProgress(data.processedChunks, data.totalChunks);
        
        // If processing is complete, close the connection cleanly
        if (data.processedChunks === data.totalChunks && data.totalChunks > 0) {
          console.log('Processing complete - closing SSE connection');
          expectingClose = true;
          
          // Give UI time to show 100% completion before closing
          setTimeout(() => {
            eventSource.close();
          }, 1000);
        }
      } else {
        console.warn('Received malformed progress data:', data);
      }
    } catch (error) {
      console.error('Error parsing progress data:', error);
    }
  };
  
  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    
    // If we've already received valid progress, don't report errors
    if (receivedValidProgress) {
      console.log('SSE connection error after receiving valid progress - ignoring');
      
      // If we're near the end (>90% done), assume it completed successfully
      if (lastProcessed > 0 && lastTotal > 0 && (lastProcessed / lastTotal) > 0.9) {
        console.log('Almost complete, closing connection silently');
        expectingClose = true;
        eventSource.close();
        
        // Send one final progress update to show 100% completion
        onProgress(lastTotal, lastTotal);
        return;
      }
    }
    
    // Don't report errors if we're expecting to close
    if (!expectingClose && !receivedValidProgress) {
      onError(new Error('Error connecting to progress updates'));
    }
    
    // Always close the connection on error to prevent duplicate connections
    try {
      eventSource.close();
    } catch (e) {
      console.error('Error closing EventSource:', e);
    }
  };
  
  // Return a cleanup function
  return () => {
    console.log('Cleaning up SSE connection');
    expectingClose = true; // Mark as expecting close to prevent error messages
    try {
      eventSource.close();
    } catch (e) {
      console.error('Error during cleanup of EventSource:', e);
    }
  };
};

export default api; 