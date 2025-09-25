import React, { useState, useEffect } from 'react';
import { getBooks } from '../services/api';
import { useNavigate, useParams } from 'react-router-dom';
import '../styles/BookGrid.css';

// Define Book interface
interface Book {
  id: number;
  title: string;
  author: string;
  description: string;
  cover_image: string;
}

const BookGrid: React.FC = () => {
  const { authorName } = useParams<{ authorName: string }>();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [filteredByAuthor, setFilteredByAuthor] = useState<string | null>(authorName || null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const navigate = useNavigate();

  useEffect(() => {
    // Update the filter if the URL parameter changes
    setFilteredByAuthor(authorName || null);
  }, [authorName]);

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        console.log('BookGrid: Fetching books from API');
        setLoading(true);
        const data = await getBooks();
        console.log('BookGrid: Books fetched successfully:', data);
        setBooks(data);
        setError('');
      } catch (err) {
        console.error('BookGrid: Error fetching books:', err);
        setError('Failed to load books. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, []);

  const handleBookClick = (bookId: number) => {
    // Navigate to chat with the selected book
    navigate(`/chat/${bookId}`);
  };

  const handleAuthorClick = (author: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent book click from also triggering
    
    if (filteredByAuthor === author) {
      // If clicking the same author again, clear the filter
      navigate('/');
    } else {
      // Navigate to author-filtered view
      navigate(`/author/${encodeURIComponent(author)}`);
    }
  };

  // Get books to display based on author filter and search query
  const displayedBooks = books.filter(book => {
    // First apply author filter if active
    if (filteredByAuthor && book.author !== filteredByAuthor) {
      return false;
    }
    
    // Then apply search filter if query exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return book.title.toLowerCase().includes(query) || 
             book.author.toLowerCase().includes(query);
    }
    
    return true;
  });

  if (loading) {
    return <div className="loading-message">Loading books...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="book-grid-container">
      {/* Search Bar */}
      <div className="search-container">
        <input
          type="text"
          placeholder="Search books by title or author..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')} 
            className="clear-search-btn"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {filteredByAuthor && (
        <div className="author-filter-header">
          <h2>Books by {filteredByAuthor}</h2>
          <button onClick={() => navigate('/')} className="clear-filter-btn">
            Show All Books
          </button>
        </div>
      )}
      
      <div className="book-grid">
        {displayedBooks.length === 0 ? (
          <div className="no-books-message">
            {searchQuery 
              ? `No books found matching "${searchQuery}"${filteredByAuthor ? ` by ${filteredByAuthor}` : ''}`
              : filteredByAuthor 
                ? `No books found by ${filteredByAuthor}` 
                : 'No books available. Please check back later.'}
          </div>
        ) : (
          displayedBooks.map(book => (
            <div 
              key={book.id} 
              className="book-item" 
              onClick={() => handleBookClick(book.id)}
            >
              <div className="book-cover-container">
                <img 
                  src={book.cover_image || 'https://via.placeholder.com/150x200?text=No+Cover'} 
                  alt={`Cover of ${book.title}`}
                  className="book-cover"
                />
              </div>
              <div className="book-details">
                <h3 className="book-title">{book.title}</h3>
                <p 
                  className="book-author" 
                  onClick={(e) => handleAuthorClick(book.author, e)}
                >
                  {book.author}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BookGrid; 