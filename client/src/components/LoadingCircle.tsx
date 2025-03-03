import React, { useEffect, useState, useRef } from 'react';
import './LoadingCircle.css';

interface LoadingCircleProps {
  show?: boolean;
  processedChunks: number;
  totalChunks: number;
  exactWordCount?: number;
  exactTokenCount?: number;
  bookId?: number;
}

const LoadingCircle: React.FC<LoadingCircleProps> = ({
  show = true,
  processedChunks,
  totalChunks,
  exactWordCount,
  exactTokenCount,
  bookId
}) => {
  // Directly use the incoming props
  const [rotation, setRotation] = useState(0);
  const animationRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // NEW STATE to store updated progress from server
  const [serverProgress, setServerProgress] = useState<{
    processedChunks: number;
    totalChunks: number;
    exactWordCount: number;
    exactTokenCount: number;
  } | null>(null);

  // OPTIONAL: periodically poll server for updated progress
  useEffect(() => {
    // Only poll if we're showing the LoadingCircle
    if (!show) return;

    const intervalId = setInterval(async () => {
      try {
        // Use book-specific progress endpoint if bookId is provided
        const url = bookId ? `/api/chat/progress/${bookId}` : '/api/progress';
        console.log(`Fetching progress from ${url}`);
        
        // Get token for authorization
        const token = localStorage.getItem('token');
        
        const response = await fetch(url, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          console.error(`Error fetching progress: ${response.status} ${response.statusText}`);
          if (response.status === 401) {
            setError('Authentication error. Please log in again.');
          } else {
            setError(`Server error: ${response.status}`);
          }
          return;
        }
        
        const data = await response.json();
        console.log('Progress data:', data);
        setServerProgress(data);
        setError(null); // Clear any previous errors
      } catch (err) {
        console.error('Failed to fetch progress:', err);
        setError('Unable to connect to the server');
      }
    }, 5000); // poll every 5 seconds

    return () => clearInterval(intervalId);
  }, [show, bookId]); // Add bookId as a dependency

  useEffect(() => {
    if (!show) return;

    const animate = () => {
      setRotation((prev) => (prev + 0.2) % 360);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [show]);

  if (!show) return null;

  // If we have server progress, prefer it over the props
  const currentProcessedChunks = serverProgress?.processedChunks ?? processedChunks;
  const currentTotalChunks = Math.max(serverProgress?.totalChunks ?? totalChunks, 1);
  const displayedWords = serverProgress?.exactWordCount ?? exactWordCount ?? 0;
  const displayedTokens = serverProgress?.exactTokenCount ?? exactTokenCount ?? 0;

  // FIX Linter Errors: define these variables
  const percentage = Math.min(
    100,
    Math.round((currentProcessedChunks / currentTotalChunks) * 100)
  );
  const circumference = 2 * Math.PI * 40; 
  const dashOffset = circumference * (1 - percentage / 100);

  // Format numbers with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };
  
  // Generate progress message
  let progressMessage = '';

  // Compute the batch numbers (just reuse existing variables, or define them if needed)
  const batchSize = 20; // or the size your server uses
  const currentBatch = Math.floor(currentProcessedChunks / batchSize) + 1;
  const totalBatches = Math.ceil(currentTotalChunks / batchSize);

  // Replace the message with your custom string
  progressMessage = `Books contain many words. This one contains ${formatNumber(displayedWords)}, which equates to ${formatNumber(displayedTokens)} tokens. ChatGPT4o only permits context windows of 128K, and so we must be clever in re-embedding the text.
Progress: Generating embeddings for batch ${currentBatch} of ${totalBatches}`;

  if (error) {
    progressMessage += `\n\nConnection issue: ${error}`;
  }

  return (
    <div className="loading-circle-container">
      <div className="loading-circle">
        {/* Background circle with rotation animation */}
        <svg 
          width="100" 
          height="100" 
          viewBox="0 0 100 100"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <circle
            className="loading-circle__background"
            cx="50"
            cy="50"
            r="40"
            fill="none"
            strokeWidth="5"
          />
        </svg>
        
        {/* Progress circle */}
        <svg 
          width="100" 
          height="100" 
          viewBox="0 0 100 100"
        >
          <circle
            className="loading-circle__progress"
            cx="50"
            cy="50"
            r="40"
            fill="none"
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 50 50)"
          />
        </svg>
        
        {/* Percentage text */}
        <div className="loading-circle__percentage">
          {percentage}%
        </div>
      </div>
      <div className="loading-circle__text">
        {progressMessage}
      </div>
    </div>
  );
};

export default LoadingCircle; 