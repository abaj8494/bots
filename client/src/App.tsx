import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import ChatInterface from './components/ChatInterface';
import BookGrid from './components/BookGrid';
import AuthPage from './components/Auth/AuthPage';
import LoadingCircle from './components/LoadingCircle';
import { useAuth } from './context/AuthContext';

function App() {
  const { isAuthenticated, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(!isAuthenticated);

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
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        {showAuth ? (
          <AuthPage onAuthSuccess={handleAuthSuccess} />
        ) : (
          <>
            <header className="App-header">
              <h1>BookBot</h1>
              <p>Preload Public Domain Books into the Context Window of the ChatGPT4o-mini model!</p>
            </header>
            <main className="App-main">
              <Routes>
                <Route path="/" element={<BookGrid />} />
                <Route path="/chat/:bookId" element={<ChatInterface />} />
                <Route path="/author/:authorName" element={<BookGrid />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </>
        )}
      </div>
    </Router>
  );
}

export default App;
