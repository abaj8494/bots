import express, { Router } from 'express';
import { Request, Response } from 'express';
import { auth } from '../middleware/auth';
import { 
  processBookContent, 
  findRelevantChunks, 
  clearEmbeddingsCache,
  getEmbeddingsCacheInfo
} from '../utils/embeddings';
import { getBookById } from '../models/Book';

const router: Router = express.Router();

// @route   POST api/embeddings/process/:bookId
// @desc    Process book content and generate embeddings
// @access  Private
router.post('/process/:bookId', auth, async (req: Request, res: Response) => {
  try {
    const bookId = parseInt(req.params.bookId);
    const userId = req.user?.id;
    
    if (!bookId || isNaN(bookId)) {
      res.status(400).json({ error: 'Invalid book ID' });
      return;
    }
    
    // Get book content
    const book = await getBookById(bookId);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    
    // Process book content and generate embeddings
    await processBookContent(bookId, book.content, userId);
    
    // Get cache info
    const cacheInfo = getEmbeddingsCacheInfo(bookId);
    
    res.json({ 
      success: true, 
      message: 'Book content processed successfully', 
      chunks: cacheInfo?.chunkCount || 0,
      totalChars: book.content.length
    });
  } catch (error: any) {
    console.error('Error processing book content:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   POST api/embeddings/search/:bookId
// @desc    Find relevant chunks for a query
// @access  Private
router.post('/search/:bookId', auth, async (req: Request, res: Response) => {
  try {
    const bookId = parseInt(req.params.bookId);
    const userId = req.user?.id;
    const { query, count } = req.body;
    
    if (!bookId || isNaN(bookId)) {
      res.status(400).json({ error: 'Invalid book ID' });
      return;
    }
    
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }
    
    // Get book to check it exists
    const book = await getBookById(bookId);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    
    // Find relevant chunks
    const relevantChunks = await findRelevantChunks(bookId, query, userId, count || 5);
    
    res.json({
      success: true,
      query,
      chunks: relevantChunks,
      count: relevantChunks.length
    });
  } catch (error: any) {
    console.error('Error finding relevant chunks:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   POST api/embeddings/clear/:bookId?
// @desc    Clear embeddings cache for a book or all books
// @access  Private
router.post('/clear/:bookId?', auth, async (req: Request, res: Response) => {
  try {
    const bookId = req.params.bookId ? parseInt(req.params.bookId) : undefined;
    
    if (req.params.bookId && (!bookId || isNaN(bookId))) {
      res.status(400).json({ error: 'Invalid book ID' });
      return;
    }
    
    // Clear cache for specific book or all books
    clearEmbeddingsCache(bookId);
    
    res.json({
      success: true,
      message: bookId 
        ? `Embeddings cache cleared for book ID ${bookId}` 
        : 'All embeddings caches cleared'
    });
  } catch (error: any) {
    console.error('Error clearing embeddings cache:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 