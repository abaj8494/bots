-- Migration: Add persistent embeddings support
-- Run this migration to add the new tables for optimized embedding storage

-- Enable pgvector extension (requires superuser privileges)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table for persistent storage
CREATE TABLE IF NOT EXISTS book_embeddings (
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
CREATE INDEX IF NOT EXISTS idx_book_embeddings_book_id ON book_embeddings(book_id);

-- Create vector similarity index (requires pgvector extension)
-- Uncomment the line below if you have pgvector installed
-- CREATE INDEX IF NOT EXISTS idx_book_embeddings_embedding ON book_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Create book_processing_status table to track embedding generation
CREATE TABLE IF NOT EXISTS book_processing_status (
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

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_book_processing_status_status ON book_processing_status(status);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_book_processing_status_updated_at 
    BEFORE UPDATE ON book_processing_status 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration complete message
DO $$ 
BEGIN 
    RAISE NOTICE 'Persistent embeddings migration completed successfully!';
    RAISE NOTICE 'Note: If you want to use vector similarity search, install pgvector extension and uncomment the vector index creation line.';
END $$;
