import React from 'react';
import './LoadingCircle.css';

interface LoadingCircleProps {
  processedChunks: number;
  totalChunks: number;
}

const LoadingCircle: React.FC<LoadingCircleProps> = ({ 
  processedChunks, 
  totalChunks 
}) => {
  // Calculate percentage for the circle fill
  const percentage = totalChunks > 0 
    ? Math.min(100, Math.floor((processedChunks / totalChunks) * 100)) 
    : 0;
  
  // Calculate the stroke dash offset based on percentage
  // SVG circle circumference = 2 * PI * radius
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percentage / 100) * circumference;
  
  // Generate a more descriptive message based on progress
  const getProgressMessage = () => {
    if (totalChunks === 0) return "Preparing to process book...";
    
    if (processedChunks === totalChunks) {
      return "Processing complete! Preparing chat interface...";
    }
    
    // Calculate batch number - matching exactly how the server calculates it
    // Server uses: Math.floor(i/batchSize) + 1 where i is the index of the chunk being processed
    const batchSize = 20;
    
    // Calculate which batch we're in - using integer division like the server
    // The server processes chunk indices 0-19 as batch 1, 20-39 as batch 2, etc.
    const currentBatch = Math.floor((processedChunks - 1) / batchSize) + 1;
    const totalBatches = Math.ceil(totalChunks / batchSize);
    
    // Handle special case for the first batch (when no chunks have been processed yet)
    if (processedChunks <= 0) {
      return `Preparing to generate embeddings (${totalBatches} batches total)`;
    }
    
    // Calculate approximate word and token counts based on chunks
    // Each chunk is about 1000 characters with 200 character overlap
    const approxCharacters = totalChunks * 800 + 200; // (1000-200)*totalChunks + 200 overlap for the last chunk
    const approxWords = Math.round(approxCharacters / 5); // Assuming average of 5 chars per word
    const approxTokens = Math.round(approxCharacters / 4); // Roughly 4 chars per token for English
    
    // Format the numbers with commas for readability
    const formattedWords = approxWords.toLocaleString();
    const formattedTokens = approxTokens.toLocaleString();
    
    return `Books contain many words. This one contains ${formattedWords}, which equates to ${formattedTokens} tokens. ChatGPT4o only permits context windows of 128K, and so we must be clever in re-embedding the text.\nProgress: batch ${currentBatch} of ${totalBatches}`;
  };
  
  return (
    <div className="loading-circle-container">
      <div className="loading-circle-overlay">
        <div className="loading-circle-message-top">
          {getProgressMessage()}
        </div>
        <svg width="120" height="120" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle 
            cx="60" 
            cy="60" 
            r={radius} 
            className="loading-circle-background"
          />
          
          {/* Progress circle */}
          <circle 
            cx="60" 
            cy="60" 
            r={radius} 
            className="loading-circle-progress"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: dashOffset
            }}
            transform="rotate(-90, 60, 60)"
          />
          
          {/* Text in the center */}
          <text 
            x="60" 
            y="60" 
            className="loading-circle-text"
            dominantBaseline="middle"
            textAnchor="middle"
          >
            {processedChunks}/{totalChunks}
          </text>
        </svg>
        <div className="loading-circle-message">
          {percentage}% complete
        </div>
      </div>
    </div>
  );
};

export default LoadingCircle; 