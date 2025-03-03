import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import './Auth.css';
import GoogleIcon from './icons/GoogleIcon';
import GithubIcon from './icons/GithubIcon';
import CursorIcon from './icons/CursorIcon';
import ClaudeIcon from './icons/ClaudeIcon';

// Use environment variable if available, otherwise default to production URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://api.abaj.cloud';

const AuthPage: React.FC<{ onAuthSuccess: () => void }> = ({ onAuthSuccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  const handleGoogleLogin = () => {
    // Redirect to Google OAuth endpoint
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  };

  const handleGithubLogin = () => {
    // Redirect to GitHub OAuth endpoint
    window.location.href = `${API_BASE_URL}/api/auth/github`;
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>Aayush Bajaj's BookBot</h1>
          <p>A simple chatbot that streamlines preloading Public Domain Books into the Context Window of ChatGPT4o-mini :)</p>
        </div>

        <div className="auth-tabs">
          <button 
            className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => setActiveTab('login')}
          >
            Sign In
          </button>
          <button 
            className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            Register
          </button>
        </div>

        <div className="auth-content">
          {activeTab === 'login' ? (
            <LoginForm onLoginSuccess={onAuthSuccess} />
          ) : (
            <RegisterForm onRegisterSuccess={() => setActiveTab('login')} />
          )}
        </div>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <div className="social-login-buttons">
          <button className="social-button google" onClick={handleGoogleLogin}>
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>
          <button className="social-button github" onClick={handleGithubLogin}>
            <GithubIcon />
            <span>Continue with GitHub</span>
          </button>
        </div>
        
        <div className="auth-footer">
          <div className="tech-icons">
            <a href="https://cursor.sh" target="_blank" rel="noopener noreferrer" title="Cursor">
              <CursorIcon />
            </a>
            <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" title="Claude AI">
              <ClaudeIcon />
            </a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" title="GitHub">
              <GithubIcon />
            </a>
          </div>
          <div className="footer-text">
            Built with Cursor and Claude. Version Controlled by Github
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage; 