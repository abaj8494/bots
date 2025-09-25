import OpenAI from 'openai';
import { getOpenAIClient } from './openai';
import db from '../config/db';
import { EventEmitter } from 'events';

// Interface for OpenAI API error response
interface OpenAIError extends Error {
  response?: {
    status: number;
    data?: any;
  };
}

// Processing status types
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'error';

// Progress tracking event emitter
export const embeddingsProgressEmitter = new EventEmitter();

// Configuration constants
const EMBEDDING_MODEL = 'text-embedding-3-small'; // Consistent model for all operations
const EMBEDDING_DIMENSIONS = 1536;
const CHUNK_SIZE = 1500; // Optimized chunk size for better context
const CHUNK_OVERLAP = 200; // Reduced overlap for efficiency
const BATCH_SIZE = 50; // Larger batch size for parallel processing
const MAX_CONCURRENT_REQUESTS = 10; // Control API rate limiting

/**
 * Enhanced text chunking with better sentence boundary detection
 */
export function chunkText(text: string, chunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): string[] {
  if (!text) return [];
  
  const chunks: string[] = [];
  let startIndex = 0;
  
  // Pre-split text into sentences for better chunking
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    // If adding this sentence would exceed chunk size, start a new chunk
    if (currentChunk && (currentChunk.length + sentence.length > chunkSize)) {
      chunks.push(currentChunk.trim());
      
      // Start new chunk with overlap from previous chunk
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.floor(overlap / 5)); // Approximate word overlap
      currentChunk = overlapWords.join(' ') + ' ' + sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  // Add the final chunk if it has content
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Generate embeddings in parallel batches with improved error handling
 */
export async function generateEmbeddingsBatch(
  chunks: string[], 
  userId?: number,
  onProgress?: (processed: number, total: number) => void
): Promise<number[][]> {
  const openai = await getOpenAIClient(userId);
  const embeddings: number[][] = [];
  
  // Process chunks in parallel batches
  const batches: string[][] = [];
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    batches.push(chunks.slice(i, i + BATCH_SIZE));
  }
  
  let processedCount = 0;
  
  // Process batches with controlled concurrency
  const semaphore = new Array(MAX_CONCURRENT_REQUESTS).fill(null);
  
  const processBatch = async (batch: string[], batchIndex: number): Promise<number[][]> => {
    const batchEmbeddings: number[][] = [];
    
    try {
      // Process chunks in the batch in parallel
      const promises = batch.map(async (chunk) => {
        const response = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: chunk,
          dimensions: EMBEDDING_DIMENSIONS
        });
        return response.data[0].embedding;
      });
      
      const results = await Promise.all(promises);
      batchEmbeddings.push(...results);
      
      processedCount += batch.length;
      if (onProgress) {
        onProgress(processedCount, chunks.length);
      }
      
      console.log(`Processed batch ${batchIndex + 1}/${batches.length} (${processedCount}/${chunks.length} chunks)`);
      
    } catch (error) {
      const apiError = error as OpenAIError;
      console.error(`Error processing batch ${batchIndex + 1}:`, apiError);
      
      if (apiError.response?.status === 429) {
        // Rate limit hit - wait and retry
        console.log('Rate limit hit, waiting before retry...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return processBatch(batch, batchIndex); // Retry
      }
      throw error;
    }
    
    return batchEmbeddings;
  };
  
  // Process all batches with controlled concurrency
  const batchPromises = batches.map((batch, index) => 
    new Promise<number[][]>(async (resolve, reject) => {
      // Wait for semaphore slot
      await new Promise<void>((semResolve) => {
        const tryAcquire = () => {
          const freeSlot = semaphore.findIndex(slot => slot === null);
          if (freeSlot !== -1) {
            semaphore[freeSlot] = true;
            semResolve();
          } else {
            setTimeout(tryAcquire, 100);
          }
        };
        tryAcquire();
      });
      
      try {
        const result = await processBatch(batch, index);
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        // Release semaphore slot
        const slotIndex = semaphore.findIndex(slot => slot === true);
        if (slotIndex !== -1) {
          semaphore[slotIndex] = null;
        }
      }
    })
  );
  
  const results = await Promise.all(batchPromises);
  
  // Flatten results maintaining order
  for (const batchResult of results) {
    embeddings.push(...batchResult);
  }
  
  return embeddings;
}

/**
 * Check if embeddings exist in database for a book
 */
export async function checkEmbeddingsExist(bookId: number): Promise<boolean> {
  const query = `
    SELECT COUNT(*) as count 
    FROM book_embeddings 
    WHERE book_id = $1
  `;
  
  const result = await db.query(query, [bookId]);
  return parseInt(result.rows[0].count) > 0;
}

/**
 * Get processing status for a book
 */
export async function getProcessingStatus(bookId: number): Promise<{
  status: ProcessingStatus;
  processed_chunks: number;
  total_chunks: number;
  word_count: number;
  token_count: number;
  error_message?: string;
} | null> {
  const query = `
    SELECT status, processed_chunks, total_chunks, word_count, token_count, error_message
    FROM book_processing_status 
    WHERE book_id = $1
  `;
  
  const result = await db.query(query, [bookId]);
  return result.rows[0] || null;
}

/**
 * Update processing status in database
 */
export async function updateProcessingStatus(
  bookId: number, 
  status: ProcessingStatus,
  processed_chunks?: number,
  total_chunks?: number,
  word_count?: number,
  token_count?: number,
  error_message?: string
): Promise<void> {
  const query = `
    INSERT INTO book_processing_status 
    (book_id, status, processed_chunks, total_chunks, word_count, token_count, error_message, started_at, completed_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 
            CASE WHEN $2 = 'processing' THEN NOW() ELSE NULL END,
            CASE WHEN $2 = 'completed' THEN NOW() ELSE NULL END,
            NOW())
    ON CONFLICT (book_id) 
    DO UPDATE SET 
      status = $2,
      processed_chunks = COALESCE($3, book_processing_status.processed_chunks),
      total_chunks = COALESCE($4, book_processing_status.total_chunks),
      word_count = COALESCE($5, book_processing_status.word_count),
      token_count = COALESCE($6, book_processing_status.token_count),
      error_message = $7,
      started_at = CASE WHEN $2 = 'processing' AND book_processing_status.started_at IS NULL 
                        THEN NOW() ELSE book_processing_status.started_at END,
      completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE NULL END,
      updated_at = NOW()
  `;
  
  await db.query(query, [bookId, status, processed_chunks, total_chunks, word_count, token_count, error_message]);
}

/**
 * Save embeddings to database
 */
export async function saveEmbeddingsToDatabase(
  bookId: number,
  chunks: string[],
  embeddings: number[][]
): Promise<void> {
  if (chunks.length !== embeddings.length) {
    throw new Error('Chunks and embeddings arrays must have the same length');
  }
  
  // Calculate word and token counts for each chunk
  const chunkData = chunks.map((chunk, index) => {
    const wordCount = chunk.split(/\s+/).filter(word => word.length > 0).length;
    const tokenCount = Math.round(wordCount * 0.75);
    return {
      chunk,
      embedding: embeddings[index],
      wordCount,
      tokenCount
    };
  });
  
  // Batch insert embeddings
  const batchSize = 100;
  for (let i = 0; i < chunkData.length; i += batchSize) {
    const batch = chunkData.slice(i, i + batchSize);
    
    const values = batch.map((item, idx) => {
      const chunkIndex = i + idx;
      return `($1, $${2 + idx * 4}, $${3 + idx * 4}, $${4 + idx * 4}, $${5 + idx * 4})`;
    }).join(', ');
    
    const params = [bookId];
    batch.forEach(item => {
      params.push(
        batch.indexOf(item) + i, // chunk_index
        item.chunk, // chunk_text
        JSON.stringify(item.embedding), // embedding as JSON
        item.wordCount // word_count
      );
    });
    
    const query = `
      INSERT INTO book_embeddings (book_id, chunk_index, chunk_text, embedding, word_count)
      VALUES ${values}
      ON CONFLICT (book_id, chunk_index) DO UPDATE SET
        chunk_text = EXCLUDED.chunk_text,
        embedding = EXCLUDED.embedding,
        word_count = EXCLUDED.word_count
    `;
    
    await db.query(query, params);
  }
}

/**
 * Load embeddings from database
 */
export async function loadEmbeddingsFromDatabase(bookId: number): Promise<{
  chunks: string[];
  embeddings: number[][];
  wordCount: number;
  tokenCount: number;
} | null> {
  const query = `
    SELECT chunk_index, chunk_text, embedding, word_count
    FROM book_embeddings 
    WHERE book_id = $1
    ORDER BY chunk_index ASC
  `;
  
  const result = await db.query(query, [bookId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const chunks: string[] = [];
  const embeddings: number[][] = [];
  let totalWordCount = 0;
  
  for (const row of result.rows) {
    chunks.push(row.chunk_text);
    embeddings.push(JSON.parse(row.embedding));
    totalWordCount += row.word_count || 0;
  }
  
  return {
    chunks,
    embeddings,
    wordCount: totalWordCount,
    tokenCount: Math.round(totalWordCount * 0.75)
  };
}

/**
 * Process a book's content with optimized performance
 */
export async function processBookContentOptimized(
  bookId: number, 
  content: string,
  userId?: number,
  forceRefresh: boolean = false
): Promise<void> {
  console.log(`Starting optimized processing for book ${bookId} (${content.length} characters)`);
  
  try {
    // Check if embeddings already exist and are not being refreshed
    if (!forceRefresh) {
      const existingStatus = await getProcessingStatus(bookId);
      if (existingStatus?.status === 'completed') {
        console.log(`Book ${bookId} already processed, using existing embeddings`);
        
        // Emit progress event for UI consistency
        embeddingsProgressEmitter.emit('progress', {
          bookId,
          processedChunks: existingStatus.processed_chunks,
          totalChunks: existingStatus.total_chunks,
          exactWordCount: existingStatus.word_count,
          exactTokenCount: existingStatus.token_count
        });
        
        return;
      }
    }
    
    // Mark as processing
    await updateProcessingStatus(bookId, 'processing');
    
    // Split content into optimized chunks
    const chunks = chunkText(content);
    console.log(`Split book ${bookId} into ${chunks.length} optimized chunks`);
    
    // Calculate word and token counts
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    const tokenCount = Math.round(wordCount * 0.75);
    
    // Update status with chunk count
    await updateProcessingStatus(bookId, 'processing', 0, chunks.length, wordCount, tokenCount);
    
    // Emit initial progress
    embeddingsProgressEmitter.emit('progress', {
      bookId,
      processedChunks: 0,
      totalChunks: chunks.length,
      exactWordCount: wordCount,
      exactTokenCount: tokenCount
    });
    
    // Generate embeddings in parallel
    const embeddings = await generateEmbeddingsBatch(chunks, userId, (processed, total) => {
      // Update database status
      updateProcessingStatus(bookId, 'processing', processed, total, wordCount, tokenCount);
      
      // Emit progress event
      embeddingsProgressEmitter.emit('progress', {
        bookId,
        processedChunks: processed,
        totalChunks: total,
        exactWordCount: wordCount,
        exactTokenCount: tokenCount
      });
    });
    
    // Save embeddings to database
    await saveEmbeddingsToDatabase(bookId, chunks, embeddings);
    
    // Mark as completed
    await updateProcessingStatus(bookId, 'completed', chunks.length, chunks.length, wordCount, tokenCount);
    
    // Emit completion event
    embeddingsProgressEmitter.emit('progress', {
      bookId,
      processedChunks: chunks.length,
      totalChunks: chunks.length,
      exactWordCount: wordCount,
      exactTokenCount: tokenCount
    });
    
    console.log(`Optimized processing complete for book ${bookId}`);
    
  } catch (error) {
    console.error(`Error in optimized processing for book ${bookId}:`, error);
    
    // Mark as error
    await updateProcessingStatus(bookId, 'error', undefined, undefined, undefined, undefined, 
      error instanceof Error ? error.message : 'Unknown error');
    
    // Emit error event
    embeddingsProgressEmitter.emit('error', {
      bookId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    throw error;
  }
}

/**
 * Find relevant chunks using database-stored embeddings
 */
export async function findRelevantChunksOptimized(
  bookId: number,
  query: string,
  userId?: number,
  maxChunks: number = 5
): Promise<string[]> {
  // Generate query embedding
  const openai = await getOpenAIClient(userId);
  const queryEmbeddingResponse = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
    dimensions: EMBEDDING_DIMENSIONS
  });
  
  const queryEmbedding = queryEmbeddingResponse.data[0].embedding;
  
  // Use database vector similarity search (requires pgvector extension)
  const query_sql = `
    SELECT chunk_text, 
           (embedding <=> $2::vector) as distance
    FROM book_embeddings 
    WHERE book_id = $1
    ORDER BY distance ASC
    LIMIT $3
  `;
  
  try {
    const result = await db.query(query_sql, [bookId, JSON.stringify(queryEmbedding), maxChunks]);
    return result.rows.map(row => row.chunk_text);
  } catch (error) {
    // Fallback to in-memory similarity calculation if vector extension not available
    console.warn('Vector similarity search failed, falling back to in-memory calculation');
    
    const embeddingData = await loadEmbeddingsFromDatabase(bookId);
    if (!embeddingData) {
      throw new Error(`No embeddings found for book ${bookId}`);
    }
    
    const { chunks, embeddings } = embeddingData;
    
    // Calculate cosine similarities
    const similarities = embeddings.map(embedding => 
      cosineSimilarity(embedding, queryEmbedding)
    );
    
    // Get top chunks
    const indices = similarities
      .map((similarity, index) => ({ similarity, index }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxChunks)
      .map(item => item.index);
    
    return indices.map(index => chunks[index]);
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Clear embeddings for a specific book
 */
export async function clearBookEmbeddings(bookId: number): Promise<void> {
  const queries = [
    'DELETE FROM book_embeddings WHERE book_id = $1',
    'DELETE FROM book_processing_status WHERE book_id = $1'
  ];
  
  for (const query of queries) {
    await db.query(query, [bookId]);
  }
  
  console.log(`Cleared embeddings for book ${bookId}`);
}

/**
 * Get embedding statistics
 */
export async function getEmbeddingStats(): Promise<{
  totalBooks: number;
  completedBooks: number;
  processingBooks: number;
  totalChunks: number;
}> {
  const query = `
    SELECT 
      COUNT(DISTINCT book_id) as total_books,
      COUNT(DISTINCT CASE WHEN status = 'completed' THEN book_id END) as completed_books,
      COUNT(DISTINCT CASE WHEN status = 'processing' THEN book_id END) as processing_books,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN total_chunks END), 0) as total_chunks
    FROM book_processing_status
  `;
  
  const result = await db.query(query);
  return {
    totalBooks: parseInt(result.rows[0].total_books) || 0,
    completedBooks: parseInt(result.rows[0].completed_books) || 0,
    processingBooks: parseInt(result.rows[0].processing_books) || 0,
    totalChunks: parseInt(result.rows[0].total_chunks) || 0
  };
}
