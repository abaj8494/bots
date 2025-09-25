import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface BookBotIconProps {
  className?: string;
}

const BookBotIcon: React.FC<BookBotIconProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Don't show on home page
  if (location.pathname === '/') {
    return null;
  }

  const handleClick = () => {
    navigate('/');
  };

  return (
    <button
      onClick={handleClick}
      className={`bookbot-icon-button ${className}`}
      aria-label="Return to BookBot Home"
      title="BookBot - Return Home"
    >
      <img 
        src="/circular_inferno.svg" 
        alt="BookBot Icon" 
        className="bookbot-icon-image"
      />
    </button>
  );
};

export default BookBotIcon;


