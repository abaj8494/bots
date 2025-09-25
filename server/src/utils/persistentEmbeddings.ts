import OpenAI from 'openai';
import { getOpenAIClient } from './openai';
import db from '../config/db';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';

// Interface for OpenAI API error response
interface OpenAIError extends Error {
  response?: {
    status: number;
    data?: any;
  };
}

// Processing status types
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'error';

// Persistent storage configuration
const STORAGE_BASE_PATH = '/mnt/blockstorage/bookbot';
const EMBEDDINGS_DIR = path.join(STORAGE_BASE_PATH, 'embeddings');
const CHUNKS_DIR = path.join(STORAGE_BASE_PATH, 'chunks');
const METADATA_DIR = path.join(STORAGE_BASE_PATH, 'metadata');

// Progress tracking event emitter
export const embeddingsProgressEmitter = new EventEmitter();

// Configuration constants - optimized for server load management
const EMBEDDING_MODEL = 'text-embedding-3-small'; // Consistent model for all operations
const EMBEDDING_DIMENSIONS = 1536;
const CHUNK_SIZE = 1500; // Optimized chunk size for better context
const CHUNK_OVERLAP = 200; // Reduced overlap for efficiency
const BATCH_SIZE = 25; // Reduced batch size to prevent server overload
const MAX_CONCURRENT_REQUESTS = 5; // Reduced concurrent requests to manage load
const REQUEST_DELAY_MS = 200; // Add delay between batches to prevent overwhelming server
const MAX_CONCURRENT_BOOKS = 1; // Only process one book at a time to prevent overload

// In-memory cache for frequently accessed embeddings
interface EmbeddingCache {
  chunks: string[];
  embeddings: number[][];
  metadata: {
    wordCount: number;
    tokenCount: number;
    lastAccessed: number;
  };
}

const embeddingCache = new Map<number, EmbeddingCache>();
const CACHE_MAX_SIZE = 3; // Keep 3 books in memory
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Processing queue to manage server load
interface ProcessingTask {
  bookId: number;
  content: string;
  userId?: number;
  forceRefresh: boolean;
  promise: {
    resolve: () => void;
    reject: (error: Error) => void;
  };
}

const processingQueue: ProcessingTask[] = [];
let currentlyProcessing = 0;

/**
 * Initialize storage directories
 */
export async function initializeStorage(): Promise<void> {
  const dirs = [STORAGE_BASE_PATH, EMBEDDINGS_DIR, CHUNKS_DIR, METADATA_DIR];
  
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`Ensured directory exists: ${dir}`);
    } catch (error) {
      console.error(`Error creating directory ${dir}:`, error);
      throw error;
    }
  }
}

/**
 * Get file paths for a book's persistent storage
 */
function getBookPaths(bookId: number) {
  return {
    embeddings: path.join(EMBEDDINGS_DIR, `book_${bookId}_embeddings.json.gz`),
    chunks: path.join(CHUNKS_DIR, `book_${bookId}_chunks.json.gz`),
    metadata: path.join(METADATA_DIR, `book_${bookId}_metadata.json`)
  };
}

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
 * Save data to compressed file
 */
async function saveCompressedData(filePath: string, data: any): Promise<void> {
  const jsonString = JSON.stringify(data);
  const writeStream = createWriteStream(filePath);
  const gzipStream = createGzip({ level: 6 }); // Good compression with reasonable speed
  
  await pipeline(
    async function* () {
      yield Buffer.from(jsonString, 'utf8');
    },
    gzipStream,
    writeStream
  );
}

/**
 * Load data from compressed file
 */
async function loadCompressedData<T>(filePath: string): Promise<T | null> {
  try {
    const readStream = createReadStream(filePath);
    const gunzipStream = createGunzip();
    
    let data = '';
    await pipeline(
      readStream,
      gunzipStream,
      async function* (source) {
        for await (const chunk of source) {
          data += chunk.toString();
        }
      }
    );
    
    return JSON.parse(data);
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return null; // File doesn't exist
    }
    throw error;
  }
}

/**
 * Save metadata to JSON file
 */
async function saveMetadata(filePath: string, metadata: any): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
}

/**
 * Load metadata from JSON file
 */
async function loadMetadata<T>(filePath: string): Promise<T | null> {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return null; // File doesn't exist
    }
    throw error;
  }
}

/**
 * Check if embeddings exist in persistent storage
 */
export async function checkEmbeddingsExist(bookId: number): Promise<boolean> {
  const paths = getBookPaths(bookId);
  
  try {
    await fs.access(paths.embeddings);
    await fs.access(paths.chunks);
    await fs.access(paths.metadata);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save embeddings to persistent storage
 */
export async function saveEmbeddingsToDisk(
  bookId: number,
  chunks: string[],
  embeddings: number[][],
  wordCount: number,
  tokenCount: number
): Promise<void> {
  await initializeStorage();
  
  const paths = getBookPaths(bookId);
  
  // Save in parallel for better performance
  await Promise.all([
    saveCompressedData(paths.chunks, chunks),
    saveCompressedData(paths.embeddings, embeddings),
    saveMetadata(paths.metadata, {
      bookId,
      chunkCount: chunks.length,
      wordCount,
      tokenCount,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      createdAt: new Date().toISOString(),
      version: '2.0' // Version for future compatibility
    })
  ]);
  
  console.log(`Saved embeddings for book ${bookId} to persistent storage`);
}

/**
 * Load embeddings from persistent storage with caching
 */
export async function loadEmbeddingsFromDisk(bookId: number): Promise<{
  chunks: string[];
  embeddings: number[][];
  wordCount: number;
  tokenCount: number;
} | null> {
  // Check in-memory cache first
  const cached = embeddingCache.get(bookId);
  if (cached) {
    cached.metadata.lastAccessed = Date.now();
    console.log(`Cache hit for book ${bookId}`);
    return {
      chunks: cached.chunks,
      embeddings: cached.embeddings,
      wordCount: cached.metadata.wordCount,
      tokenCount: cached.metadata.tokenCount
    };
  }
  
  const paths = getBookPaths(bookId);
  
  try {
    // Load in parallel for better performance
    const [chunks, embeddings, metadata] = await Promise.all([
      loadCompressedData<string[]>(paths.chunks),
      loadCompressedData<number[][]>(paths.embeddings),
      loadMetadata<any>(paths.metadata)
    ]);
    
    if (!chunks || !embeddings || !metadata) {
      return null;
    }
    
    console.log(`Loaded embeddings for book ${bookId} from persistent storage`);
    
    // Add to cache
    await addToCache(bookId, chunks, embeddings, metadata.wordCount, metadata.tokenCount);
    
    return {
      chunks,
      embeddings,
      wordCount: metadata.wordCount,
      tokenCount: metadata.tokenCount
    };
  } catch (error) {
    console.error(`Error loading embeddings for book ${bookId}:`, error);
    return null;
  }
}

/**
 * Add embeddings to in-memory cache with LRU eviction
 */
async function addToCache(
  bookId: number, 
  chunks: string[], 
  embeddings: number[][],
  wordCount: number,
  tokenCount: number
): Promise<void> {
  // Remove old entries if cache is full
  if (embeddingCache.size >= CACHE_MAX_SIZE) {
    let oldestKey: number | null = null;
    let oldestTime = Date.now();
    
    for (const [key, value] of embeddingCache.entries()) {
      if (value.metadata.lastAccessed < oldestTime) {
        oldestTime = value.metadata.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey !== null) {
      embeddingCache.delete(oldestKey);
      console.log(`Evicted book ${oldestKey} from cache`);
    }
  }
  
  embeddingCache.set(bookId, {
    chunks,
    embeddings,
    metadata: {
      wordCount,
      tokenCount,
      lastAccessed: Date.now()
    }
  });
  
  console.log(`Added book ${bookId} to cache`);
}

/**
 * Clean up expired cache entries
 */
export function cleanupCache(): void {
  const now = Date.now();
  const expiredKeys: number[] = [];
  
  for (const [key, value] of embeddingCache.entries()) {
    if (now - value.metadata.lastAccessed > CACHE_TTL) {
      expiredKeys.push(key);
    }
  }
  
  for (const key of expiredKeys) {
    embeddingCache.delete(key);
    console.log(`Expired book ${key} from cache`);
  }
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
      
      // Add delay between batches to prevent server overload
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
      }
      
    } catch (error) {
      const apiError = error as OpenAIError;
      console.error(`Error processing batch ${batchIndex + 1}:`, apiError);
      
      if (apiError.response?.status === 429) {
        // Rate limit hit - wait longer and retry
        console.log('Rate limit hit, waiting before retry...');
        await new Promise(resolve => setTimeout(resolve, 10000));
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
 * Get processing status for a book (database + disk check)
 */
export async function getProcessingStatus(bookId: number): Promise<{
  status: ProcessingStatus;
  processed_chunks: number;
  total_chunks: number;
  word_count: number;
  token_count: number;
  error_message?: string;
  storage_location?: string;
} | null> {
  // Check database first
  const query = `
    SELECT status, processed_chunks, total_chunks, word_count, token_count, error_message
    FROM book_processing_status 
    WHERE book_id = $1
  `;
  
  const result = await db.query(query, [bookId]);
  const dbStatus = result.rows[0];
  
  // Check if embeddings exist on disk
  const existsOnDisk = await checkEmbeddingsExist(bookId);
  
  if (existsOnDisk && (!dbStatus || dbStatus.status !== 'completed')) {
    // Embeddings exist on disk but database is out of sync
    const paths = getBookPaths(bookId);
    const metadata = await loadMetadata<any>(paths.metadata);
    
    if (metadata) {
      return {
        status: 'completed',
        processed_chunks: metadata.chunkCount,
        total_chunks: metadata.chunkCount,
        word_count: metadata.wordCount,
        token_count: metadata.tokenCount,
        storage_location: 'disk'
      };
    }
  }
  
  if (dbStatus) {
    return {
      ...dbStatus,
      storage_location: existsOnDisk ? 'both' : 'database'
    };
  }
  
  return null;
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
 * Process the next task in the queue
 */
async function processNextInQueue(): Promise<void> {
  if (processingQueue.length === 0 || currentlyProcessing >= MAX_CONCURRENT_BOOKS) {
    return;
  }
  
  const task = processingQueue.shift();
  if (!task) return;
  
  currentlyProcessing++;
  
  try {
    await processBookContentInternal(task.bookId, task.content, task.userId, task.forceRefresh);
    task.promise.resolve();
  } catch (error) {
    task.promise.reject(error as Error);
  } finally {
    currentlyProcessing--;
    // Process next task in queue
    setTimeout(processNextInQueue, 1000); // Small delay between tasks
  }
}

/**
 * Add a book processing task to the queue
 */
export async function processBookContentPersistent(
  bookId: number, 
  content: string,
  userId?: number,
  forceRefresh: boolean = false
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // Check if this book is already in queue or processing
    const existingTask = processingQueue.find(task => task.bookId === bookId);
    if (existingTask) {
      console.log(`Book ${bookId} is already queued for processing`);
      return;
    }
    
    const task: ProcessingTask = {
      bookId,
      content,
      userId,
      forceRefresh,
      promise: { resolve, reject }
    };
    
    processingQueue.push(task);
    console.log(`Added book ${bookId} to processing queue (position: ${processingQueue.length})`);
    
    // Try to start processing immediately
    processNextInQueue();
  });
}

/**
 * Internal processing function (actual implementation)
 */
async function processBookContentInternal(
  bookId: number, 
  content: string,
  userId?: number,
  forceRefresh: boolean = false
): Promise<void> {
  console.log(`Starting persistent processing for book ${bookId} (${content.length} characters)`);
  
  try {
    // Check if embeddings already exist and are not being refreshed
    if (!forceRefresh) {
      const existsOnDisk = await checkEmbeddingsExist(bookId);
      if (existsOnDisk) {
        console.log(`Book ${bookId} embeddings found on disk, loading...`);
        
        // Load metadata for progress reporting
        const paths = getBookPaths(bookId);
        const metadata = await loadMetadata<any>(paths.metadata);
        
        if (metadata) {
          // Update database status if needed
          await updateProcessingStatus(bookId, 'completed', 
            metadata.chunkCount, metadata.chunkCount, 
            metadata.wordCount, metadata.tokenCount);
          
          // Emit progress event for UI consistency
          embeddingsProgressEmitter.emit('progress', {
            bookId,
            processedChunks: metadata.chunkCount,
            totalChunks: metadata.chunkCount,
            exactWordCount: metadata.wordCount,
            exactTokenCount: metadata.tokenCount
          });
          
          return;
        }
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
    
    // Save embeddings to persistent storage
    await saveEmbeddingsToDisk(bookId, chunks, embeddings, wordCount, tokenCount);
    
    // Add to cache
    await addToCache(bookId, chunks, embeddings, wordCount, tokenCount);
    
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
    
    console.log(`Persistent processing complete for book ${bookId}`);
    
  } catch (error) {
    console.error(`Error in persistent processing for book ${bookId}:`, error);
    
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
 * Find relevant chunks using persistent storage with caching
 */
export async function findRelevantChunksPersistent(
  bookId: number,
  query: string,
  userId?: number,
  maxChunks: number = 5
): Promise<string[]> {
  // Load embeddings (from cache or disk)
  const embeddingData = await loadEmbeddingsFromDisk(bookId);
  if (!embeddingData) {
    throw new Error(`No embeddings found for book ${bookId}`);
  }
  
  const { chunks, embeddings } = embeddingData;
  
  // Generate query embedding
  const openai = await getOpenAIClient(userId);
  const queryEmbeddingResponse = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
    dimensions: EMBEDDING_DIMENSIONS
  });
  
  const queryEmbedding = queryEmbeddingResponse.data[0].embedding;
  
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
 * Clear embeddings for a specific book (both disk and cache)
 */
export async function clearBookEmbeddings(bookId: number): Promise<void> {
  // Remove from cache
  embeddingCache.delete(bookId);
  
  // Remove from disk
  const paths = getBookPaths(bookId);
  const filesToRemove = [paths.embeddings, paths.chunks, paths.metadata];
  
  for (const filePath of filesToRemove) {
    try {
      await fs.unlink(filePath);
      console.log(`Deleted ${filePath}`);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        console.error(`Error deleting ${filePath}:`, error);
      }
    }
  }
  
  // Remove from database
  const queries = [
    'DELETE FROM book_embeddings WHERE book_id = $1',
    'DELETE FROM book_processing_status WHERE book_id = $1'
  ];
  
  for (const query of queries) {
    await db.query(query, [bookId]);
  }
  
  console.log(`Cleared all embeddings for book ${bookId}`);
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  diskUsage: { [bookId: string]: number };
  cacheSize: number;
  totalBooksOnDisk: number;
  totalDiskUsage: number;
}> {
  await initializeStorage();
  
  const diskUsage: { [bookId: string]: number } = {};
  let totalDiskUsage = 0;
  let totalBooksOnDisk = 0;
  
  try {
    const files = await fs.readdir(EMBEDDINGS_DIR);
    
    for (const file of files) {
      if (file.endsWith('_embeddings.json.gz')) {
        const bookId = file.match(/book_(\d+)_embeddings\.json\.gz/)?.[1];
        if (bookId) {
          const filePath = path.join(EMBEDDINGS_DIR, file);
          const stats = await fs.stat(filePath);
          diskUsage[bookId] = stats.size;
          totalDiskUsage += stats.size;
          totalBooksOnDisk++;
        }
      }
    }
  } catch (error) {
    console.error('Error reading embeddings directory:', error);
  }
  
  return {
    diskUsage,
    cacheSize: embeddingCache.size,
    totalBooksOnDisk,
    totalDiskUsage
  };
}

// Set up periodic cache cleanup
setInterval(cleanupCache, 5 * 60 * 1000); // Every 5 minutes

// Initialize storage on module load
initializeStorage().catch(error => {
  console.error('Failed to initialize persistent storage:', error);
});
