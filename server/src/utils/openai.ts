import OpenAI from 'openai';
import { getApiKeyByUserId } from '../models/User';
import { ChatCompletionMessageParam } from 'openai/resources';

// Simple in-memory cache for responses
interface CacheEntry {
  response: string;
  timestamp: number;
}

// Cache structure: { bookId_message_hash: CacheEntry }
const responseCache: Record<string, CacheEntry> = {};

// Cache expiration time: 24 hours (in milliseconds)
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

// Generate a simple hash for the message
const generateMessageHash = (message: string): string => {
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
};

export const getOpenAIClient = async (userId?: number) => {
  let apiKey: string;
  
  if (userId) {
    // Try to get user's API key
    const userApiKey = await getApiKeyByUserId(userId);
    
    if (userApiKey && userApiKey.api_key) {
      apiKey = userApiKey.api_key;
    } else {
      // Fall back to default API key
      apiKey = process.env.OPENAI_API_KEY as string;
    }
  } else {
    // Use default API key
    apiKey = process.env.OPENAI_API_KEY as string;
  }
  
  return new OpenAI({
    apiKey,
  });
};

// Define a type for chat history messages
export interface ChatHistoryMessage {
  message: string;
  response: string;
}

export const generateChatResponse = async (
  message: string,
  bookContent: string,
  userId?: number,
  chatHistory?: ChatHistoryMessage[],
  bookId?: number
) => {
  try {
    if (!bookContent || bookContent.trim() === '') {
      console.error('Book content is empty or undefined');
      return "I'm sorry, I don't have enough information about this book to respond.";
    }

    console.log(`Generating chat response for message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    console.log(`Book content length: ${bookContent.length} characters`);
    
    // Check cache if bookId is provided
    if (bookId) {
      const messageHash = generateMessageHash(message);
      const cacheKey = `${bookId}_${messageHash}`;
      
      // Check if we have a cached response that hasn't expired
      if (responseCache[cacheKey] && 
          (Date.now() - responseCache[cacheKey].timestamp) < CACHE_EXPIRATION) {
        console.log(`Cache hit for message: "${message.substring(0, 30)}..."`);
        return responseCache[cacheKey].response;
      }
    }
    
    const openai = await getOpenAIClient(userId);
    
    // Use the entire book content instead of just a preview
    // Build messages array with system message first
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are an AI assistant that specializes in discussing and analyzing literature. 
                 You have deep knowledge about the following book: 
                 
                 ${bookContent}
                 
                 RESPONSE STYLE GUIDELINES:
                 1. Be direct and concise in your responses.
                 2. Use bullet points (•) whenever possible to structure information clearly.
                 3. Include brief references to specific parts of the book (e.g., "Chapter 3", "Early in the story", "During the climax").
                 4. Use direct quotes from the book when relevant, formatted with quotation marks.
                 5. If asked about content not in this book, politely redirect the conversation back to this specific work.
                 
                 Example format:
                 • Main point (reference to book section)
                   "Relevant quote from the text" 
                 • Second point with analysis
                 • Third point with conclusion`
      }
    ];
    
    // Add chat history if provided (up to 10 previous exchanges)
    if (chatHistory && chatHistory.length > 0) {
      // Limit to last 10 exchanges instead of 5
      const recentHistory = chatHistory.slice(-10);
      
      // Add each exchange as a user and assistant message
      recentHistory.forEach(exchange => {
        messages.push({ role: 'user', content: exchange.message });
        messages.push({ role: 'assistant', content: exchange.response });
      });
      
      console.log(`Added ${recentHistory.length} previous exchanges to context`);
    }
    
    // Add the current user message
    messages.push({
      role: 'user',
      content: message
    });
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 500
    });
    
    const responseContent = response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
    console.log(`Generated response: "${responseContent.substring(0, 50)}${responseContent.length > 50 ? '...' : ''}"`);
    
    // Cache the response if bookId is provided
    if (bookId) {
      const messageHash = generateMessageHash(message);
      const cacheKey = `${bookId}_${messageHash}`;
      
      responseCache[cacheKey] = {
        response: responseContent,
        timestamp: Date.now()
      };
      
      // Simple cache management - if cache gets too large, remove oldest entries
      const MAX_CACHE_SIZE = 1000;
      const cacheKeys = Object.keys(responseCache);
      if (cacheKeys.length > MAX_CACHE_SIZE) {
        // Sort by timestamp and remove oldest entries
        const oldestKeys = cacheKeys
          .sort((a, b) => responseCache[a].timestamp - responseCache[b].timestamp)
          .slice(0, cacheKeys.length - MAX_CACHE_SIZE);
        
        oldestKeys.forEach(key => delete responseCache[key]);
        console.log(`Cache cleanup: removed ${oldestKeys.length} oldest entries`);
      }
    }
    
    return responseContent;
  } catch (error: any) {
    console.error('Error generating chat response:', error);
    if (error.response) {
      console.error('OpenAI API error details:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    throw new Error(`Failed to generate response from OpenAI: ${error.message}`);
  }
}; 