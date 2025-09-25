-- Drop tables if they exist
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS user_api_keys;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS books;

-- Create books table
CREATE TABLE books (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  cover_image VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user_api_keys table
CREATE TABLE user_api_keys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  api_key VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create chat_messages table
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create embeddings table for persistent storage
CREATE TABLE book_embeddings (
  id SERIAL PRIMARY KEY,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1536) NOT NULL,
  word_count INTEGER DEFAULT 0,
  token_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(book_id, chunk_index)
);

-- Create index for faster similarity searches
CREATE INDEX idx_book_embeddings_book_id ON book_embeddings(book_id);
CREATE INDEX idx_book_embeddings_embedding ON book_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Create book_processing_status table to track embedding generation
CREATE TABLE book_processing_status (
  book_id INTEGER PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, error
  total_chunks INTEGER DEFAULT 0,
  processed_chunks INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  token_count INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample books
INSERT INTO books (title, author, description, content, cover_image) VALUES
('1984', 'George Orwell', 'A dystopian novel set in a totalitarian society', 'Sample content for 1984...', 'https://example.com/1984.jpg'),
('Hamlet', 'William Shakespeare', 'The Tragedy of Hamlet, Prince of Denmark', 'Sample content for Hamlet...', 'https://example.com/hamlet.jpg'); 