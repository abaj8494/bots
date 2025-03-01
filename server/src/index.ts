import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Import routes
import authRoutes from './routes/auth';
import booksRoutes from './routes/books';
import chatRoutes from './routes/chat';
import { getBookById } from './models/Book';
import { generateChatResponse } from './utils/openai';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
// Serve static files from public directory
app.use('/static', express.static(path.join(__dirname, '../public')));

// Demo chat endpoint - no auth required
app.post('/api/demo-chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, bookId, chatHistory } = req.body;
    
    console.log(`Received demo chat request - bookId: ${bookId}, message: "${message?.substring(0, 50)}${message?.length > 50 ? '...' : ''}"`);
    
    if (!message || !bookId) {
      console.error('Missing required parameters:', { message: !!message, bookId: !!bookId });
      res.status(400).json({ msg: 'Message and bookId are required' });
      return;
    }
    
    // Get book content
    const book = await getBookById(bookId);
    if (!book) {
      console.error(`Book not found with ID: ${bookId}`);
      res.status(404).json({ msg: 'Book not found' });
      return;
    }
    
    console.log(`Generating response for book: ${book.title}, message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    
    // Check if book has content
    if (!book.content || book.content.trim() === '') {
      console.error(`Book ${book.title} (ID: ${bookId}) has no content`);
      res.status(500).json({ msg: 'Book content is missing' });
      return;
    }
    
    // Generate response using OpenAI, passing chat history if available and bookId for caching
    const response = await generateChatResponse(message, book.content, undefined, chatHistory, bookId);
    
    // We don't save the chat message to the database for demo purposes
    console.log(`Successfully generated response for book: ${book.title}`);
    
    res.json({ response });
  } catch (err: any) {
    console.error('Demo chat error:', err);
    res.status(500).json({ 
      msg: 'Failed to generate response',
      error: err.message 
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/chat', chatRoutes);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../../client/build')));

  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, '../../client/build', 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 