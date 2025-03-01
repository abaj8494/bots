import express, { Request, Response } from 'express';
import { auth } from '../middleware/auth';
import { getAllBooks, getBookById, createBook, updateBook, deleteBook } from '../models/Book';

const router = express.Router();

// @route   GET api/books
// @desc    Get all books
// @access  Public
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log('Fetching all books...');
    const books = await getAllBooks();
    console.log('Books fetched successfully:', books);
    res.json(books);
  } catch (err) {
    console.error('Error fetching books:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET api/books/:id
// @desc    Get book by ID
// @access  Public
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const book = await getBookById(parseInt(req.params.id));
    
    if (!book) {
      return res.status(404).json({ msg: 'Book not found' });
    }
    
    res.json(book);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST api/books
// @desc    Create a new book (admin only in a real app)
// @access  Private
router.post('/', auth, async (req: Request, res: Response) => {
  try {
    const { title, author, description, content, cover_image } = req.body;
    
    const newBook = await createBook({
      title,
      author,
      description,
      content,
      cover_image
    });
    
    res.json(newBook);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   PUT api/books/:id
// @desc    Update a book (admin only in a real app)
// @access  Private
router.put('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { title, author, description, content, cover_image } = req.body;
    const bookId = parseInt(req.params.id);
    
    // Check if book exists
    const book = await getBookById(bookId);
    if (!book) {
      return res.status(404).json({ msg: 'Book not found' });
    }
    
    const updatedBook = await updateBook(bookId, {
      title,
      author,
      description,
      content,
      cover_image
    });
    
    res.json(updatedBook);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   PUT api/books/:id/cover
// @desc    Update a book cover (for testing purposes)
// @access  Public
router.put('/:id/cover', async (req: Request, res: Response) => {
  try {
    const { cover_image } = req.body;
    const bookId = parseInt(req.params.id);
    
    // Check if book exists
    const book = await getBookById(bookId);
    if (!book) {
      return res.status(404).json({ msg: 'Book not found' });
    }
    
    const updatedBook = await updateBook(bookId, {
      cover_image
    });
    
    res.json(updatedBook);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   DELETE api/books/:id
// @desc    Delete a book (admin only in a real app)
// @access  Private
router.delete('/:id', auth, async (req: Request, res: Response) => {
  try {
    const bookId = parseInt(req.params.id);
    
    // Check if book exists
    const book = await getBookById(bookId);
    if (!book) {
      return res.status(404).json({ msg: 'Book not found' });
    }
    
    await deleteBook(bookId);
    
    res.json({ msg: 'Book removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router; 