import OpenAI from 'openai';
import { getApiKeyByUserId } from '../models/User';
import { ChatCompletionMessageParam } from 'openai/resources';
import { 
  processBookContent, 
  findRelevantChunks,
  checkEmbeddingsExist,
  ensureEmbeddingsReady
} from './embeddings';

// Simple in-memory cache for responses
interface CacheEntry {
  response: string;
  timestamp: number;
}

// Cache structure: { bookId_message_hash: CacheEntry }
const responseCache: Record<string, CacheEntry> = {};

// Cache expiration time: 24 hours (in milliseconds)
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

// Maximum book size for processing (in characters)
// 1.5 million chars is roughly a 300k word book (very large book)
const MAX_BOOK_SIZE = 1500000;

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
    
    // Check if book is extremely large
    if (bookContent.length > MAX_BOOK_SIZE) {
      console.warn(`Book content exceeds maximum recommended size (${bookContent.length} > ${MAX_BOOK_SIZE} characters)`);
      
      // If asking about size or experiencing issues
      const sizeRelatedTerms = [
        'size', 'large', 'big', 'error', 'issue', 'problem', 'not working',
        'slow', 'timeout', 'fail', 'breaks', 'broken', 'stuck'
      ];
      
      if (sizeRelatedTerms.some(term => message.toLowerCase().includes(term))) {
        return "I notice you're asking about a very large book. The current book exceeds our recommended size limits. " +
          "Our developers are working on adding a method to chunk books by chapters for better handling of extensive texts like this one. " +
          "In the meantime, you might experience some limitations when discussing this particular book. " +
          "Please try asking more specific questions about particular sections, which may help me provide more accurate responses.";
      }
    }
    
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
    
    // Create book embeddings if they don't exist yet
    if (bookId) {
      try {
        // Check if embeddings exist without waiting for processing
        const embeddingsExist = await checkEmbeddingsExist(bookId);
        
        if (!embeddingsExist) {
          console.log(`First-time processing for book ${bookId}. Starting embeddings generation...`);
          
          // Start embeddings generation in the background (don't await)
          processBookContent(bookId, bookContent, userId)
            .then(() => console.log(`Background embeddings generation complete for book ${bookId}`))
            .catch(err => console.error(`Background embeddings generation failed for book ${bookId}:`, err));
          
          // Return a friendly message instead of an error
          return "I'm currently processing this book for the first time, which may take up to 3 minutes for larger texts. ";
        }
        
        // Normal flow - embeddings already exist
        console.log(`Embeddings already exist for book ${bookId}, proceeding with query`);
        await ensureEmbeddingsReady(bookId);
      } catch (error) {
        console.error('Error checking or preparing embeddings:', error);
        // Continue with fallback approach
      }
    }
    
    // Relevant content to include in the prompt
    let relevantContent: string;
    
    // Use embeddings to find relevant book sections if possible
    if (bookId) {
      try {
        console.log('Finding relevant chunks using embeddings...');
        
        // Find the most relevant chunks for this question
        const relevantChunks = await findRelevantChunks(bookId, message, userId, 5);
        
        console.log(`Found ${relevantChunks.length} relevant chunks for the query`);
        
        // Use these chunks instead of the full book content
        relevantContent = relevantChunks.join('\n\n...\n\n');
      } catch (error) {
        console.error('Error finding relevant chunks:', error);
        // Fall back to trimmed content
        const MAX_CONTENT_CHARS = 100000;
        relevantContent = bookContent.length > MAX_CONTENT_CHARS 
          ? bookContent.substring(0, MAX_CONTENT_CHARS) + "... [Content trimmed due to length]" 
          : bookContent;
      }
    } else {
      // Fall back if no bookId
      const MAX_CONTENT_CHARS = 100000;
      relevantContent = bookContent.length > MAX_CONTENT_CHARS 
        ? bookContent.substring(0, MAX_CONTENT_CHARS) + "... [Content trimmed due to length]" 
        : bookContent;
    }
    
    console.log(`Using ${relevantContent.length} characters of relevant book content for the response`);
    
    const openai = await getOpenAIClient(userId);
    
    // Build messages array with system message first
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are a knowledgeable Literature professor. You know enough that you do not feel the necessity to prove your intellect or bow down to anyone. Due to your tenure, your answers are maximally brief and concise. AI assistant that specializes in discussing and analyzing literature. 
                 You have knowledge about a book, and I've selected the most relevant sections
                 of the book for your current question. These sections are:
                 
                 ${relevantContent}
                 
                 IMPORTANT MARKDOWN FORMATTING REQUIREMENTS:
                 You MUST format your responses using Markdown with the following elements:
                 1. ALWAYS start with a "###" heading as a title for your response
                 2. Use "**bold text**" for emphasis and important concepts
                 3. Use "*italic text*" for book titles and special terms
                 4. Use proper bullet points with "-" or numbered lists where appropriate
                 5. Include direct quotes from the book using blockquotes with ">"
                 6. Organize longer responses with "##" or "###" section headings
                 
                 Additional response guidelines:
                 - Be direct and concise in your responses
                 - Include brief references to specific parts of the book
                 - If asked about content not in these sections, acknowledge you're only working with excerpts
                 - Focus on the provided sections and don't make up content
                 
                 Example format:
                 ### Analysis of Character Development
                 
                 The protagonist **James** undergoes significant transformation throughout the story:
                 
                 - **Early chapters**: His initial reluctance is shown when:
                   > "James hesitated at the doorway, unsure if he should proceed." (Chapter 2)
                 
                 - **Climax**: His character arc completes with:
                   > "No longer afraid, James stepped confidently forward."
                 
                 ## Key Themes
                 
                 1. **Courage** in the face of adversity
                 2. The power of *self-discovery*
                 
                 THIS IS CRITICAL: Your response MUST include proper markdown formatting with headings, bold text, and other elements as shown above.`
      }
    ];
    
    // Add chat history if provided (limit to 20 previous exchanges to save tokens)
    if (chatHistory && chatHistory.length > 0) {
      // Limit to last 20 exchanges to save on token usage
      const recentHistory = chatHistory.slice(-20);
      
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
      max_tokens: 2000
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