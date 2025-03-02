import React, { useState, useEffect } from 'react';
import './App.css';
import ChatInterface from './components/ChatInterface';
import AuthPage from './components/Auth/AuthPage';
import { useAuth } from './context/AuthContext';

function App() {
  const { isAuthenticated, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(true);

  // Handle successful authentication
  const handleAuthSuccess = () => {
    setShowAuth(false);
  };

  // On mount or when authentication status changes
  useEffect(() => {
    if (isAuthenticated) {
      setShowAuth(false);
    }
  }, [isAuthenticated]);

  // Show loading spinner while checking authentication status
  if (loading) {
    return (
      <div className="App">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {showAuth && !isAuthenticated ? (
        <AuthPage onAuthSuccess={handleAuthSuccess} />
      ) : (
        <>
          <header className="App-header">
            <h1>BookBot</h1>
            <p>Chat with your favorite books using AI</p>
          </header>
          <main className="App-main">
            <ChatInterface />
          </main>
        </>
      )}
    </div>
  );
}

export default App;
