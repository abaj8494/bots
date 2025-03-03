import React from 'react';
import githubSvg from './github.svg';

const GithubIcon: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <img 
      src={githubSvg} 
      alt="GitHub" 
      className={className} 
      style={{ width: '20px', height: '20px' }} 
    />
  );
};

export default GithubIcon; 