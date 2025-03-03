import React from 'react';
import claudeSvg from './claude.svg';

const ClaudeIcon: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <img 
      src={claudeSvg} 
      alt="Claude AI" 
      className={className} 
      style={{ width: '24px', height: '24px' }} 
    />
  );
};

export default ClaudeIcon; 