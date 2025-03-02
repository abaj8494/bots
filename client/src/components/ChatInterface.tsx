import React, { useState, useEffect, useRef } from 'react';
import { getBooks, sendChatMessage, trackEmbeddingProgress } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './ChatInterface.css';
import LoadingCircle from './LoadingCircle';

interface Message {
  id: number;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface Book {
  id: number;
  title: string;
  author: string;
  description: string;
  cover_image: string;
}

const ChatInterface: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingChunks, setIsProcessingChunks] = useState(false);
  const [chunkProgress, setChunkProgress] = useState({ processed: 0, total: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Ref to hold the cleanup function for event source
  const progressCleanupRef = useRef<(() => void) | null>(null);

  // Fetch books on component mount
  useEffect(() => {
    const fetchBooks = async () => {
      console.log('ChatInterface: Starting to fetch books...');
      try {
        console.log('ChatInterface: Calling getBooks API...');
        const books = await getBooks();
        console.log('ChatInterface: Books received from API:', books);
        
        if (!books || books.length === 0) {
          console.warn('ChatInterface: No books received from the API');
          setMessages([
            {
              id: Date.now(),
              text: "No books are available. Please contact the administrator.",
              isUser: false,
              timestamp: new Date()
            }
          ]);
          return;
        }
        
        setBooks(books);
        if (books.length > 0) {
          console.log('ChatInterface: Setting first book as selected book:', books[0]);
          setSelectedBook(books[0]);
          // Add welcome message
          setMessages([
            {
              id: 1,
              text: `Welcome! You're now chatting with "${books[0].title}" by ${books[0].author}. Ask me anything about this book!`,
              isUser: false,
              timestamp: new Date()
            }
          ]);
        }
      } catch (error) {
        console.error('Error fetching books:', error);
        setMessages([
          {
            id: Date.now(),
            text: "Failed to load books. Please try refreshing the page or contact support.",
            isUser: false,
            timestamp: new Date()
          }
        ]);
      }
    };

    fetchBooks();
  }, []);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleBookChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const bookId = parseInt(e.target.value);
    const book = books.find(b => b.id === bookId) || null;
    setSelectedBook(book);
    
    if (book) {
      setMessages([
        {
          id: Date.now(),
          text: `You're now chatting with "${book.title}" by ${book.author}. Ask me anything about this book!`,
          isUser: false,
          timestamp: new Date()
        }
      ]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !selectedBook) return;
    
    const userMessage: Message = {
      id: Date.now(),
      text: inputMessage,
      isUser: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    
    try {
      // Prepare chat history from previous messages
      // Only include actual exchanges (user messages and AI responses)
      // Skip welcome messages or system notifications
      const chatHistory = messages
        .filter(msg => msg.id !== 1) // Skip welcome message
        .reduce((result: { message: string; response: string }[], msg, index, array) => {
          // If this is a user message and the next message exists and is an AI response
          if (msg.isUser && index + 1 < array.length && !array[index + 1].isUser) {
            result.push({
              message: msg.text,
              response: array[index + 1].text
            });
          }
          return result;
        }, []);
      
      console.log(`Sending chat request with ${chatHistory.length} previous exchanges`);
      
      // Use the API service to send chat message
      const response = await sendChatMessage(selectedBook.id, inputMessage, chatHistory);
      
      // If response indicates first-time processing, start tracking progress
      if (response.response && response.response.includes("processing this book for the first time")) {
        setIsProcessingChunks(true);
        setChunkProgress({ processed: 0, total: 0 });
        
        // Start tracking progress
        if (progressCleanupRef.current) {
          progressCleanupRef.current(); // Clean up any existing connection
        }
        
        progressCleanupRef.current = trackEmbeddingProgress(
          selectedBook.id,
          (processedChunks, totalChunks) => {
            setChunkProgress({ 
              processed: processedChunks, 
              total: totalChunks 
            });
            
            // If processing is complete, hide the loading circle
            if (processedChunks === totalChunks && totalChunks > 0) {
              setIsProcessingChunks(false);
            }
          },
          (error) => {
            console.error('Error tracking progress:', error);
            setIsProcessingChunks(false);
          }
        );
      }
      
      // Ensure the response is properly formatted for Markdown
      const processedResponse = response.response || "I couldn't generate a response. Please try again.";
      
      // Add AI response to messages
      const aiMessage: Message = {
        id: Date.now() + 1,
        text: processedResponse,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: Date.now() + 1,
        text: "Sorry, there was an error processing your request. Please try again.",
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Clean up event source on unmount
  useEffect(() => {
    return () => {
      if (progressCleanupRef.current) {
        progressCleanupRef.current();
      }
    };
  }, []);

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>BookBot Chat</h2>
        <select 
          value={selectedBook?.id || ''} 
          onChange={handleBookChange}
          className="book-selector"
        >
          {books.map(book => (
            <option key={book.id} value={book.id}>
              {book.title} by {book.author}
            </option>
          ))}
        </select>
      </div>
      
      {selectedBook && (
        <div className="book-info">
          <img 
            src={selectedBook.cover_image || 'https://via.placeholder.com/100x150?text=No+Cover'} 
            alt={`Cover of ${selectedBook.title}`}
            className="book-cover"
          />
          <div className="book-details">
            <h3>{selectedBook.title}</h3>
            <h4>by {selectedBook.author}</h4>
            <p>{selectedBook.description}</p>
          </div>
        </div>
      )}
      
      <div className="messages-container">
        {messages.map(message => (
          <div 
            key={message.id} 
            className={`message ${message.isUser ? 'user-message' : 'bot-message'}`}
          >
            <div className="message-content">
              {message.isUser ? (
                message.text
              ) : (
                <>
                  {/* Debug only: Show the raw markdown */}
                  {/* <pre style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'monospace', 
                    fontSize: '12px', 
                    padding: '8px', 
                    background: '#f5f5f5', 
                    borderRadius: '4px', 
                    marginBottom: '8px', 
                    display: 'none'
                  }}>
                    {message.text}
                  </pre> */}
                  
                  <div className="markdown-content">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]} 
                      components={{
                        h1: ({node, ...props}) => <h1 style={{
                          fontSize: '1.6em', 
                          fontWeight: 'bold', 
                          marginTop: '0.7em', 
                          marginBottom: '0.5em', 
                          display: 'block',
                          color: '#212529'
                        }} {...props} />,
                        h2: ({node, ...props}) => <h2 style={{
                          fontSize: '1.4em', 
                          fontWeight: 'bold', 
                          marginTop: '0.7em', 
                          marginBottom: '0.5em', 
                          display: 'block',
                          color: '#212529'
                        }} {...props} />,
                        h3: ({node, ...props}) => <h3 style={{
                          fontSize: '1.25em', 
                          fontWeight: 'bold', 
                          marginTop: '0.7em', 
                          marginBottom: '0.5em', 
                          display: 'block',
                          color: '#212529'
                        }} {...props} />,
                        strong: ({node, ...props}) => <strong style={{
                          fontWeight: 'bold', 
                          color: '#212529',
                          display: 'inline'
                        }} {...props} />,
                        em: ({node, ...props}) => <em style={{
                          fontStyle: 'italic',
                          display: 'inline'
                        }} {...props} />,
                        p: ({node, ...props}) => <p style={{
                          margin: '0.5em 0 0.7em',
                          lineHeight: '1.5',
                          display: 'block'
                        }} {...props} />,
                        ul: ({node, ...props}) => <ul style={{
                          paddingLeft: '20px', 
                          margin: '0.7em 0',
                          display: 'block'
                        }} {...props} />,
                        ol: ({node, ...props}) => <ol style={{
                          paddingLeft: '20px', 
                          margin: '0.7em 0',
                          display: 'block'
                        }} {...props} />,
                        li: ({node, ...props}) => <li style={{
                          marginBottom: '0.35em', 
                          display: 'list-item'
                        }} {...props} />,
                        blockquote: ({node, ...props}) => <blockquote style={{
                          borderLeft: '4px solid #6c757d',
                          padding: '0.5em 0.8em',
                          margin: '0.7em 0',
                          color: '#495057',
                          fontStyle: 'italic',
                          backgroundColor: 'rgba(0,0,0,0.03)',
                          borderRadius: '0 4px 4px 0',
                          display: 'block'
                        }} {...props} />
                      }}
                    >
                      {message.text}
                    </ReactMarkdown>
                  </div>
                </>
              )}
            </div>
            <div className="message-timestamp">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message bot-message">
            <div className="message-content typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="message-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Ask something about the book..."
          disabled={isLoading || !selectedBook}
        />
        <button type="submit" disabled={isLoading || !inputMessage.trim() || !selectedBook}>
          Send
        </button>
      </form>
      
      {/* Add the loading circle for chunk processing */}
      {isProcessingChunks && (
        <LoadingCircle 
          processedChunks={chunkProgress.processed} 
          totalChunks={chunkProgress.total} 
        />
      )}
    </div>
  );
};

export default ChatInterface; 