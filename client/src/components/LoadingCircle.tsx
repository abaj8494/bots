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
  
  return (
    <div className="loading-circle-container">
      <div className="loading-circle-overlay">
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
        <div className="loading-circle-message">Processing book chunks...</div>
      </div>
    </div>
  );
};

export default LoadingCircle; 