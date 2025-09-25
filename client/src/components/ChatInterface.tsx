import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getBooks, sendChatMessage, getBook, trackEmbeddingProgress, API_URL } from '../services/api';
import LoadingCircle from './LoadingCircle';
import './ChatInterface.css';
import axios from 'axios';
import { getToken } from '../services/auth';

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
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Loading book details...",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // For progress tracking and loading states
  const [isProcessingChunks, setIsProcessingChunks] = useState(false);
  const [chunkProgress, setChunkProgress] = useState({ 
    processed: 0, 
    total: 0, 
    wordCount: 0, 
    tokenCount: 0 
  });
  const [loadingText, setLoadingText] = useState('Processing book...');
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const progressCleanupRef = useRef<() => void>(() => {});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Add a new state for handling query limits
  const [queryLimitExceeded, setQueryLimitExceeded] = useState(false);
  const [queryLimitInfo, setQueryLimitInfo] = useState<{
    limit: number;
    count: number;
    upgrade?: boolean;
    subscription?: {
      tier: string;
      limit: number;
      upgradePrice?: number;
      upgradeCurrency?: string;
      upgradeLimit?: number;
    }
  } | null>(null);

  // Fetch books on component mount
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        console.log('Fetching books from API');
        const data = await getBooks();
        console.log('Books fetched successfully:', data);
        setBooks(data);
        
        // If no books are available
        if (!data || data.length === 0) {
          setMessages([
            {
              id: 1,
              text: "No books are available at the moment. Please check back later.",
              isUser: false,
              timestamp: new Date()
            }
          ]);
          return;
        }
        
        // If there's a bookId in the URL, find that book
        if (bookId) {
          const bookIdNum = parseInt(bookId, 10);
          const book = data.find((book: Book) => book.id === bookIdNum);
          if (book) {
            setSelectedBook(book);
            // Instead of immediately showing a welcome message, just show a loading message
            setMessages([
              {
                id: 1,
                text: `Loading "${book.title}" by ${book.author}...`,
                isUser: false,
                timestamp: new Date()
              }
            ]);
            
            // Check if we need to process embeddings by making a test message request
            console.log('Checking if embeddings need to be processed...');
            setIsProcessingChunks(true); // Start showing loading immediately
            setChunkProgress({ processed: 0, total: 1, wordCount: 0, tokenCount: 0 }); // Start with indefinite progress
            
            // Send an initial message to trigger embedding process if needed
            sendChatMessage(bookIdNum, "Are you ready to discuss this book?", [])
              .then(response => {
                console.log('Initial message response:', response);
                // Don't add the test message to the chat history
                if (response.response && response.response.includes("processing this book for the first time")) {
                  console.log('Book needs initial processing');
                  // The book is being processed for the first time
                  // Start tracking progress
                  if (progressCleanupRef.current) {
                    progressCleanupRef.current(); // Clean up any existing connection
                  }
                  
                  progressCleanupRef.current = trackEmbeddingProgress(
                    bookIdNum,
                    (processedChunks, totalChunks, wordCount, tokenCount) => {
                      console.log(`Processing chunks: ${processedChunks}/${totalChunks}, words: ${wordCount}, tokens: ${tokenCount}`);
                      
                      // Only update progress if the total is non-zero 
                      // This prevents showing incorrect batch counts during initialization
                      if (totalChunks > 0) {
                        setChunkProgress(current => {
                          // Keep the highest word and token counts we've seen
                          const newWordCount = Math.max(wordCount || 0, current.wordCount || 0);
                          const newTokenCount = Math.max(tokenCount || 0, current.tokenCount || 0);
                          
                          // Log if we're updating the counts
                          if (newWordCount > current.wordCount) {
                            console.log(`Updating word count to higher value: ${newWordCount} (was ${current.wordCount})`);
                          }
                          if (newTokenCount > current.tokenCount) {
                            console.log(`Updating token count to higher value: ${newTokenCount} (was ${current.tokenCount})`);
                          }
                          
                          return { 
                            processed: processedChunks, 
                            total: totalChunks,
                            wordCount: newWordCount,
                            tokenCount: newTokenCount
                          };
                        });
                      }
                      
                      // IMPORTANT: Only hide the loading circle when we're COMPLETELY done
                      // and have received valid data (both values > 0)
                      if (processedChunks === totalChunks && totalChunks > 0 && processedChunks > 0) {
                        // Wait a moment to show the 100% completion state
                        // Use a longer delay to ensure the entire process has finished
                        setTimeout(() => {
                          // Double check that we're still in the same state before hiding
                          setChunkProgress(current => {
                            // Only hide if we're still showing complete
                            if (current.processed === current.total && current.total > 0) {
                              setIsProcessingChunks(false);
                              // Update the welcome message to indicate processing is complete
                              updateWelcomeMessage(`I have now loaded "${book.title}" by ${book.author} into our context window. Whilst I am not an expert on this text, I do have a more local memory of the tokens which compose it. Ask me a question and I shall respond with Markdown :P`);
                            }
                            return current;
                          });
                        }, 3000); // Increased delay to ensure full completion
                      }
                    },
                    (error) => {
                      console.error('Error tracking progress:', error);
                      
                      // Only show error message and hide loading if we haven't received any progress updates
                      // If we've already started processing and have some progress, 
                      // don't disrupt the user experience with an error
                      if (chunkProgress.total === 0) {
                        setIsProcessingChunks(false);
                        
                        // Check if this is a connection error or a processing error
                        const errorMessage = error.message || 'Unknown error';
                        const isConnectionError = errorMessage.includes('connecting');
                        
                        // Show error message only if we haven't made any progress
                        updateWelcomeMessage(`Error processing book: ${errorMessage}. Please try again later.`);
                      } else {
                        // If we have some progress but encounter an error, just log it
                        // but don't disrupt the user - the book might have processed successfully
                        console.log('Error during progress tracking, but continuing since progress was being made');
                      }
                    }
                  );
                } else {
                  // Book is already processed - now show the welcome message
                  console.log('Book is already processed');
                  setIsProcessingChunks(false);
                  // Update the welcome message now that processing is complete
                  updateWelcomeMessage(`I have loaded "${book.title}" by ${book.author} into our context window. Whilst I am not an expert on this text, I do have a more local memory of the tokens which compose it. Ask me a question and I shall respond with Markdown :P`);
                }
              })
              .catch(error => {
                console.error('Error checking book processing status:', error);
                setIsProcessingChunks(false);
                setMessages([
                  {
                    id: 1,
                    text: `Error connecting to the server: ${error.message}. Please try again later.`,
                    isUser: false,
                    timestamp: new Date()
                  }
                ]);
              });
          } else {
            // If book not found, show error and redirect to home
            setMessages([
              {
                id: 1,
                text: "Sorry, the requested book was not found.",
                isUser: false,
                timestamp: new Date()
              }
            ]);
            setTimeout(() => navigate('/'), 3000);
          }
        } else if (data.length > 0) {
          // If no bookId specified but books exist, redirect to home
          navigate('/');
        }
      } catch (error) {
        console.error('Error fetching books:', error);
        setMessages([
          {
            id: 1,
            text: "Failed to load books. Please try again later.",
            isUser: false,
            timestamp: new Date()
          }
        ]);
      }
    };

    fetchBooks();
  }, [bookId, navigate]);

  // Automatically scroll to the bottom of messages when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle changing the selected book
  const handleBookChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const bookId = parseInt(e.target.value, 10);
    
    // Cleanup any ongoing processing before changing books
    if (isProcessingChunks && progressCleanupRef.current) {
      console.log('Cleaning up processing for previous book before switching');
      progressCleanupRef.current(); // Close the EventSource connection
      setIsProcessingChunks(false); // Hide the loading circle
    }
    
    // Navigate to the new book's chat URL
    navigate(`/chat/${bookId}`);
  };

  // Handle sending a message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || isLoading || !selectedBook) return;
    
    // Add message to UI immediately
    const tempMessage: Message = {
      id: Date.now(),
      text: inputMessage,
      isUser: true,
      timestamp: new Date()
    };
    
    try {
      setIsLoading(true);
      
      setMessages(prev => [...prev, tempMessage]);
      setInputMessage('');
      
      // Scroll to the bottom
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      
      // Send to server
      const response = await axios.post(`${API_URL}/api/chat/${selectedBook!.id}`, {
        message: inputMessage,
      }, {
        headers: {
          Authorization: `Bearer ${getToken()}`
        }
      });
      
      // Add the bot's response as a new message, not by updating the user's message
      const botMessage: Message = {
        id: response.data.id || Date.now(),
        text: response.data.response || response.data.message || "Sorry, I didn't receive a proper response.",
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botMessage]);
      
      // Reset query limit state
      setQueryLimitExceeded(false);
      setQueryLimitInfo(null);
      
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      // Check if this is a query limit error
      if (error.response && error.response.status === 429) {
        setQueryLimitExceeded(true);
        setQueryLimitInfo(error.response.data);
        
        // Remove the temp message
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      } else {
        // Update the temp message with the error
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessage.id 
            ? {...msg, response: 'Sorry, something went wrong. Please try again.'} 
            : msg
        ));
      }
    } finally {
      setIsLoading(false);
      
      // Scroll to the bottom
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
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

  // Don't lose messages when a book is first being processed
  // Only replace the welcome message, not the entire conversation
  const updateWelcomeMessage = (newText: string) => {
    setMessages(prev => {
      // If we only have one message (the welcome message), replace it
      if (prev.length === 1 && prev[0].id === 1) {
        return [{
          id: 1,
          text: newText,
          isUser: false,
          timestamp: new Date()
        }];
      }
      
      // Otherwise, only update the welcome message and keep others
      return prev.map(msg => {
        if (msg.id === 1) {
          return {
            ...msg,
            text: newText
          };
        }
        return msg;
      });
    });
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="header-left">
          <button 
            onClick={() => navigate('/')} 
            className="home-button"
            aria-label="Go to home"
            title="Back to Books"
          >
            🏠
          </button>
          <h2>Chat with Aayush's BookBot</h2>
        </div>
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
              {message.timestamp && (
                typeof message.timestamp === 'object' 
                  ? message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              )}
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
          exactWordCount={chunkProgress.wordCount}
          exactTokenCount={chunkProgress.tokenCount}
          showProgress={true}
          text={loadingText}
          error={loadingError}
        />
      )}

      {/* Add JSX for query limit exceeded notification */}
      {queryLimitExceeded && queryLimitInfo && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">
                Daily Query Limit Reached
              </h3>
              <div className="mt-2 text-sm text-amber-700">
                <p>You've used {queryLimitInfo.count} of your {queryLimitInfo.limit} daily queries.</p>
                {queryLimitInfo.upgrade && queryLimitInfo.subscription && (
                  <div className="mt-3">
                    <p>Upgrade to Premium for {queryLimitInfo.subscription.upgradeLimit} queries/day.</p>
                    <a 
                      href="/subscription" 
                      className="mt-2 inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                    >
                      Upgrade for ${queryLimitInfo.subscription.upgradePrice} {queryLimitInfo.subscription.upgradeCurrency}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface; 