import express, { Router } from 'express';
import { Request, Response, RequestHandler } from 'express';
import { auth } from '../middleware/auth';
import { getBookById } from '../models/Book';
import { saveChatMessage, getChatHistoryByUserAndBook, deleteChatHistory } from '../models/Chat';
import { generateChatResponse, ChatHistoryMessage } from '../utils/openai';
import { 
  embeddingsProgressEmitter, 
  getEmbeddingsProgress 
} from '../utils/embeddings';
import { checkQueryLimit } from '../middleware/queryLimit';

const router: Router = express.Router();

// @route   GET api/chat/progress/:bookId
// @desc    Stream embedding progress updates for a book
// @access  Private
router.get('/progress/:bookId', auth, (req: Request, res: Response) => {
  const bookId = parseInt(req.params.bookId);
  
  if (!req.user || !req.user.id) {
    res.status(401).json({ msg: 'User not authenticated' });
    return;
  }
  
  // CORS headers for EventSource connections
  res.setHeader('Access-Control-Allow-Origin', 'https://bots.abaj.ai');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering
  
  // Increase the max event listeners to prevent warnings
  embeddingsProgressEmitter.setMaxListeners(100);
  
  console.log(`SSE connection established for book ${bookId}, user ${req.user.id}`);
  
  // Send initial progress if available
  const initialProgress = getEmbeddingsProgress(bookId);
  if (initialProgress) {
    res.write(`data: ${JSON.stringify(initialProgress)}\n\n`);
    // Flush the data immediately
    res.flushHeaders();
  } else {
    res.write(`data: ${JSON.stringify({ 
      processedChunks: 0, 
      totalChunks: 0, 
      exactWordCount: 0, 
      exactTokenCount: 0 
    })}\n\n`);
    // Flush the data immediately
    res.flushHeaders();
  }
  
  // Function to handle progress updates
  const progressHandler = (data: { 
    bookId: number; 
    processedChunks: number; 
    totalChunks: number;
    exactWordCount?: number;
    exactTokenCount?: number;
    error?: string;
  }) => {
    if (data.bookId === bookId) {
      // Enhanced logging for debugging
      console.log(`Progress update for book ${bookId}: ${data.processedChunks}/${data.totalChunks}, words: ${data.exactWordCount || 0}, tokens: ${data.exactTokenCount || 0}`);
      
      try {
        // Send SSE event with progress data
        res.write(`data: ${JSON.stringify({
          processedChunks: data.processedChunks,
          totalChunks: data.totalChunks,
          exactWordCount: data.exactWordCount || 0,
          exactTokenCount: data.exactTokenCount || 0,
          error: data.error
        })}\n\n`);
        
        // Flush data immediately
        res.flushHeaders();
        
        // If processing is complete, send a final update and keep connection
        // open for a moment to ensure the client receives it
        if (data.processedChunks === data.totalChunks && data.totalChunks > 0) {
          console.log(`Processing completed for book ${bookId}, sending final update`);
          
          // Send a final completion message to ensure client gets it
          setTimeout(() => {
            try {
              res.write(`data: ${JSON.stringify({
                processedChunks: data.totalChunks,
                totalChunks: data.totalChunks,
                exactWordCount: data.exactWordCount || 0,
                exactTokenCount: data.exactTokenCount || 0,
                completed: true
              })}\n\n`);
              res.flushHeaders();
            } catch (err) {
              console.error(`Error sending final update for book ${bookId}:`, err);
            }
          }, 500);
        }
      } catch (err) {
        console.error(`Error sending progress update for book ${bookId}:`, err);
      }
    }
  };
  
  // Register event listener
  embeddingsProgressEmitter.on('progress', progressHandler);
  
  // Handle client disconnect
  req.on('close', () => {
    embeddingsProgressEmitter.off('progress', progressHandler);
    res.end();
  });
});

// @route   POST api/chat/:bookId
// @desc    Send a message to chat with a book
// @access  Private
router.post('/:bookId', auth, checkQueryLimit, async (req: Request, res: Response) => {
  try {
    const { message, chatHistory: clientChatHistory } = req.body;
    const bookId = parseInt(req.params.bookId);
    
    if (!req.user || !req.user.id) {
      res.status(401).json({ msg: 'User not authenticated' });
      return;
    }
    
    const userId = req.user.id;
    
    // Get book content
    const book = await getBookById(bookId);
    if (!book) {
      res.status(404).json({ msg: 'Book not found' });
      return;
    }
    
    // Get previous chat history for context
    const previousChats = await getChatHistoryByUserAndBook(userId, bookId);
    
    // Convert to the format expected by generateChatResponse
    const chatHistory: ChatHistoryMessage[] = previousChats.map(chat => ({
      message: chat.message,
      response: chat.response
    }));
    
    // Generate response using OpenAI with chat history and pass bookId for caching
    const response = await generateChatResponse(message, book.content, userId, chatHistory, bookId);
    
    // Save chat message to database
    const chatMessage = await saveChatMessage({
      user_id: userId,
      book_id: bookId,
      message,
      response
    });
    
    res.json(chatMessage);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ msg: 'Failed to generate response' });
  }
});

// @route   GET api/chat/:bookId
// @desc    Get chat history for a book
// @access  Private
router.get('/:bookId', auth, async (req: Request, res: Response) => {
  try {
    const bookId = parseInt(req.params.bookId);
    
    if (!req.user || !req.user.id) {
      res.status(401).json({ msg: 'User not authenticated' });
      return;
    }
    
    const userId = req.user.id;
    
    // Check if book exists
    const book = await getBookById(bookId);
    if (!book) {
      res.status(404).json({ msg: 'Book not found' });
      return;
    }
    
    // Get chat history
    const chatHistory = await getChatHistoryByUserAndBook(userId, bookId);
    
    res.json(chatHistory);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   DELETE api/chat/:bookId
// @desc    Delete chat history for a book
// @access  Private
router.delete('/:bookId', auth, async (req: Request, res: Response) => {
  try {
    const bookId = parseInt(req.params.bookId);
    
    if (!req.user || !req.user.id) {
      res.status(401).json({ msg: 'User not authenticated' });
      return;
    }
    
    const userId = req.user.id;
    
    // Delete chat history
    const deletedCount = await deleteChatHistory(userId, bookId);
    
    res.json({ msg: 'Chat history deleted', count: deletedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router; 