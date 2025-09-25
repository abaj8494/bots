import express, { Router } from 'express';
import { Request, Response } from 'express';
import { auth } from '../middleware/auth';
import { 
  processBookContentPersistent, 
  findRelevantChunksPersistent, 
  clearBookEmbeddings,
  getProcessingStatus,
  getStorageStats,
  checkEmbeddingsExist
} from '../utils/persistentEmbeddings';
import { getBookById } from '../models/Book';

const router: Router = express.Router();

// @route   POST api/embeddings/process/:bookId
// @desc    Process book content and generate embeddings (optimized)
// @access  Private
router.post('/process/:bookId', auth, async (req: Request, res: Response) => {
  try {
    const bookId = parseInt(req.params.bookId);
    const userId = req.user?.id;
    const forceRefresh = req.body.forceRefresh === true;
    
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
    
    // Check if already processing or completed
    const status = await getProcessingStatus(bookId);
    if (status?.status === 'processing') {
      res.json({ 
        success: true, 
        message: 'Book is currently being processed',
        status: status.status,
        progress: {
          processed: status.processed_chunks,
          total: status.total_chunks
        }
      });
      return;
    }
    
    // Process book content with persistent storage
    processBookContentPersistent(bookId, book.content, userId, forceRefresh)
      .catch(error => console.error(`Background processing failed for book ${bookId}:`, error));
    
    res.json({ 
      success: true, 
      message: 'Book processing started', 
      totalChars: book.content.length,
      estimatedTime: Math.ceil(book.content.length / 50000) // Rough estimate in minutes
    });
  } catch (error: any) {
    console.error('Error starting book processing:', error);
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
    
    // Find relevant chunks using persistent storage
    const relevantChunks = await findRelevantChunksPersistent(bookId, query, userId, count || 5);
    
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

// @route   DELETE api/embeddings/clear/:bookId
// @desc    Clear embeddings for a specific book
// @access  Private
router.delete('/clear/:bookId', auth, async (req: Request, res: Response) => {
  try {
    const bookId = parseInt(req.params.bookId);
    
    if (!bookId || isNaN(bookId)) {
      res.status(400).json({ error: 'Invalid book ID' });
      return;
    }
    
    // Clear embeddings for specific book
    await clearBookEmbeddings(bookId);
    
    res.json({
      success: true,
      message: `Embeddings cleared for book ID ${bookId}`
    });
  } catch (error: any) {
    console.error('Error clearing book embeddings:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   GET api/embeddings/status/:bookId
// @desc    Get processing status for a book
// @access  Private
router.get('/status/:bookId', auth, async (req: Request, res: Response) => {
  try {
    const bookId = parseInt(req.params.bookId);
    
    if (!bookId || isNaN(bookId)) {
      res.status(400).json({ error: 'Invalid book ID' });
      return;
    }
    
    const status = await getProcessingStatus(bookId);
    const exists = await checkEmbeddingsExist(bookId);
    
    res.json({
      success: true,
      bookId,
      exists,
      status: status || { status: 'not_started', processed_chunks: 0, total_chunks: 0 }
    });
  } catch (error: any) {
    console.error('Error getting processing status:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   GET api/embeddings/stats
// @desc    Get storage and embedding statistics
// @access  Private
router.get('/stats', auth, async (req: Request, res: Response) => {
  try {
    const stats = await getStorageStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('Error getting storage stats:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 