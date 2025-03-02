import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getBooks, sendChatMessage, getBook, trackEmbeddingProgress } from '../services/api';
import LoadingCircle from './LoadingCircle';
import './ChatInterface.css';

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
  
  // For tracking chunk processing progress
  const [isProcessingChunks, setIsProcessingChunks] = useState(false);
  const [chunkProgress, setChunkProgress] = useState({ processed: 0, total: 0 });
  const progressCleanupRef = useRef<() => void>(() => {});
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
            setMessages([
              {
                id: 1,
                text: `You're now chatting with "${book.title}" by ${book.author}. Ask me anything about this book!`,
                isUser: false,
                timestamp: new Date()
              }
            ]);
            
            // Check if we need to process embeddings by making a test message request
            console.log('Checking if embeddings need to be processed...');
            setIsProcessingChunks(true); // Start showing loading immediately
            setChunkProgress({ processed: 0, total: 1 }); // Start with indefinite progress
            
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
                    (processedChunks, totalChunks) => {
                      console.log(`Processing chunks: ${processedChunks}/${totalChunks}`);
                      
                      // Only update progress if the total is non-zero 
                      // This prevents showing incorrect batch counts during initialization
                      if (totalChunks > 0) {
                        setChunkProgress({ 
                          processed: processedChunks, 
                          total: totalChunks 
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
                  // Book is already processed
                  console.log('Book is already processed');
                  setIsProcessingChunks(false);
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
            // Only update progress if the total is non-zero 
            // This prevents showing incorrect batch counts during initialization
            if (totalChunks > 0) {
              setChunkProgress({ 
                processed: processedChunks, 
                total: totalChunks 
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
                    // Add a message indicating processing is complete
                    setMessages(prev => [
                      ...prev,
                      {
                        id: Date.now() + 2,
                        text: `Processing complete! I have now loaded "${selectedBook.title}" by ${selectedBook.author} into our context window. Ask me a question about this book.`,
                        isUser: false,
                        timestamp: new Date()
                      }
                    ]);
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
          show={true}
          processedChunks={chunkProgress.processed} 
          totalChunks={chunkProgress.total} 
        />
      )}
    </div>
  );
};

export default ChatInterface; 