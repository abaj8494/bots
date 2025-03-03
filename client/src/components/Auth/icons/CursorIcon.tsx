import React from 'react';
import cursorSvg from './cursor.svg';

const CursorIcon: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <img 
      src={cursorSvg} 
      alt="Cursor" 
      className={className} 
      style={{ width: '24px', height: '24px' }} 
    />
  );
};

export default CursorIcon; 