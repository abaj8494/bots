import React, { useEffect, useState, useRef } from 'react';
import './LoadingCircle.css';

interface LoadingCircleProps {
  show?: boolean;
  processedChunks: number;
  totalChunks: number;
}

const LoadingCircle: React.FC<LoadingCircleProps> = ({
  show = true,
  processedChunks,
  totalChunks,
}) => {
  // Store the highest value we've seen for processed and total chunks
  // This prevents the progress from going backwards if updates arrive out of order
  const [highestProcessed, setHighestProcessed] = useState(0);
  const [highestTotal, setHighestTotal] = useState(0);
  
  // Animation for background rotation
  const animationRef = useRef<number | null>(null);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    // Update highest values if current values are higher
    if (processedChunks > highestProcessed) {
      setHighestProcessed(processedChunks);
    }
    
    if (totalChunks > highestTotal && totalChunks > 0) {
      setHighestTotal(totalChunks);
    }
    
    // Log updates to help debugging
    if (processedChunks > 0 || totalChunks > 0) {
      console.log(`LoadingCircle: received update - processed: ${processedChunks}, total: ${totalChunks}`);
    }
  }, [processedChunks, totalChunks, highestProcessed, highestTotal]);
  
  // Animation loop for background rotation
  useEffect(() => {
    if (!show) return;
    
    const animate = () => {
      setRotation(prev => (prev + 0.2) % 360);
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

  // Use the highest values we've seen for calculations
  const effectiveProcessed = Math.max(highestProcessed, processedChunks);
  const effectiveTotal = Math.max(highestTotal, totalChunks, 1); // Prevent division by zero
  
  // Calculate percentage filled (0-100)
  const percentage = effectiveTotal > 0 
    ? Math.min(100, Math.round((effectiveProcessed / effectiveTotal) * 100)) 
    : 0;
  
  // Calculate stroke dash offset based on percentage
  const circumference = 2 * Math.PI * 40; // Circle radius is 40px
  const dashOffset = circumference * (1 - percentage / 100);
  
  // Calculate batch numbers (starting from 1 for user-friendly display)
  const currentBatch = effectiveProcessed > 0 ? effectiveProcessed : 0;
  const totalBatches = effectiveTotal > 0 ? effectiveTotal : 0;
  
  // Calculate words and tokens based on actual data
  // Adjust character count estimate based on actual book data
  const avgCharsPerChunk = 1000; // More realistic character count per chunk
  const actualCharacters = effectiveTotal * avgCharsPerChunk;
  
  // Average English word is ~5 characters
  const approxWords = Math.round(actualCharacters / 5);
  
  // Tokens are roughly 3/4 of word count for English text
  const approxTokens = Math.round(approxWords * 0.75);
  
  // Format numbers with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };
  
  // Generate progress message
  let progressMessage = '';
  
  if (effectiveTotal === 0) {
    progressMessage = 'Preparing to process book...';
  } else if (effectiveProcessed === 0) {
    progressMessage = `Getting ready to process ${formatNumber(approxWords)} words (${formatNumber(approxTokens)} tokens)`;
  } else if (effectiveProcessed < effectiveTotal) {
    // Calculate batch numbers more accurately for server display
    const batchSize = 20; // Server processes chunks in batches of 20
    const serverCurrentBatch = Math.floor(effectiveProcessed / batchSize) + 1;
    const serverTotalBatches = Math.ceil(effectiveTotal / batchSize);
    
    progressMessage = `Processing batch ${serverCurrentBatch}/${serverTotalBatches}`;
    progressMessage += `\nProcessed ${formatNumber(effectiveProcessed)} of ${formatNumber(effectiveTotal)} chunks`;
    progressMessage += `\nBook contains approximately ${formatNumber(approxWords)} words (${formatNumber(approxTokens)} tokens)`;
  } else {
    progressMessage = `Completed processing ${formatNumber(approxWords)} words (${formatNumber(approxTokens)} tokens)`;
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