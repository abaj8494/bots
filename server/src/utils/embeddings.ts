import OpenAI from 'openai';
import { getOpenAIClient } from './openai';

// In-memory cache for embeddings
// Structure: { bookId: { chunks: string[], embeddings: number[][] } }
type EmbeddingsCache = Record<number, {
  chunks: string[];
  embeddings: number[][];
  isProcessing?: boolean;
  progress?: {
    processedChunks: number;
    totalChunks: number;
    exactWordCount?: number;
    exactTokenCount?: number;
  };
}>;

const embeddingsCache: EmbeddingsCache = {};

// Progress tracking event emitter
import { EventEmitter } from 'events';
export const embeddingsProgressEmitter = new EventEmitter();

/**
 * Check if embeddings exist for a book without waiting for processing
 */
export async function checkEmbeddingsExist(bookId: number): Promise<boolean> {
  return !!embeddingsCache[bookId] && 
         !!embeddingsCache[bookId].chunks && 
         !!embeddingsCache[bookId].embeddings && 
         embeddingsCache[bookId].chunks.length > 0;
}

/**
 * Get current embeddings progress for a book
 */
export function getEmbeddingsProgress(bookId: number): { 
  processedChunks: number; 
  totalChunks: number;
  exactWordCount: number;
  exactTokenCount: number;
} | null {
  if (!embeddingsCache[bookId]) {
    console.log(`No cache entry found for book ${bookId} in getEmbeddingsProgress`);
    return null;
  }
  
  if (!embeddingsCache[bookId].progress) {
    console.log(`Cache entry exists for book ${bookId} but no progress object found`);
    return null;
  }
  
  // Get the basic progress from the cache
  const progress = embeddingsCache[bookId].progress;
  console.log(`Raw progress data for book ${bookId}:`, JSON.stringify(progress));
  
  // Calculate word and token counts if not already present
  const wordCount = progress.exactWordCount || calculateWordCount(bookId);
  const tokenCount = progress.exactTokenCount || Math.round(wordCount * 0.75); // Approximate tokens as 75% of words
  
  console.log(`Returning progress for book ${bookId}: processed=${progress.processedChunks}, total=${progress.totalChunks}, words=${wordCount}, tokens=${tokenCount}`);
  
  return {
    ...progress,
    exactWordCount: wordCount,
    exactTokenCount: tokenCount
  };
}

/**
 * Calculate the word count for a book's content
 */
function calculateWordCount(bookId: number): number {
  if (!embeddingsCache[bookId] || !embeddingsCache[bookId].chunks) {
    console.log(`No chunks found for book ${bookId} to calculate word count`);
    return 0;
  }
  
  // Calculate word count based on chunks
  const allText = embeddingsCache[bookId].chunks.join(' ');
  console.log(`Calculating word count for book ${bookId} with ${embeddingsCache[bookId].chunks.length} chunks`);
  const wordCount = allText.split(/\s+/).filter(word => word.length > 0).length;
  console.log(`Book ${bookId} has ${wordCount} words`);
  
  // Cache the word count in the progress object
  if (embeddingsCache[bookId].progress) {
    embeddingsCache[bookId].progress.exactWordCount = wordCount;
    embeddingsCache[bookId].progress.exactTokenCount = Math.round(wordCount * 0.75);
    console.log(`Cached word count (${wordCount}) and token count (${Math.round(wordCount * 0.75)}) for book ${bookId}`);
  }
  
  return wordCount;
}

/**
 * Ensure embeddings are ready (wait if they're being processed)
 */
export async function ensureEmbeddingsReady(bookId: number): Promise<void> {
  // If embeddings are being processed, wait for them to complete
  if (embeddingsCache[bookId]?.isProcessing) {
    console.log(`Waiting for embeddings to complete for book ${bookId}...`);
    
    // Wait up to 30 seconds (check every 500ms)
    for (let i = 0; i < 60; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if processing is complete
      if (!embeddingsCache[bookId]?.isProcessing) {
        console.log(`Embeddings processing completed for book ${bookId}`);
        return;
      }
    }
    
    // If we get here, processing took too long
    throw new Error(`Timed out waiting for embeddings to complete for book ${bookId}`);
  }
}

// Expose a way to get chunk count from outside
export function getEmbeddingsCacheInfo(bookId: number): { chunkCount: number } | null {
  if (!embeddingsCache[bookId]) {
    return null;
  }
  
  return {
    chunkCount: embeddingsCache[bookId].chunks.length
  };
}

/**
 * Split text into overlapping chunks of a specified size
 */
export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  if (!text) return [];
  
  const chunks: string[] = [];
  let startIndex = 0;
  
  while (startIndex < text.length) {
    // Calculate end index, ensuring we don't go beyond text length
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    
    // Extract chunk
    const chunk = text.substring(startIndex, endIndex);
    chunks.push(chunk);
    
    // Move start index forward, accounting for overlap
    startIndex = endIndex - overlap;
    
    // If we're near the end and the remaining text is smaller than the overlap,
    // just include it in the last chunk and break
    if (startIndex + overlap >= text.length) {
      break;
    }
  }
  
  return chunks;
}

/**
 * Generate embeddings for an array of text chunks
 */
export async function generateEmbeddings(
  chunks: string[], 
  userId?: number,
  bookId?: number
): Promise<number[][]> {
  const openai = await getOpenAIClient(userId);
  const embeddings: number[][] = [];
  
  // Process chunks in batches to avoid rate limits
  const batchSize = 20; // Adjust based on API limits
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batchChunks = chunks.slice(i, i + batchSize);
    console.log(`Generating embeddings for batch ${i/batchSize + 1} of ${Math.ceil(chunks.length/batchSize)}`);
    
    // Create embeddings for this batch
    const batchPromises = batchChunks.map(async (chunk, index) => {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk,
        dimensions: 1536 // Standard for this model
      });
      
      // Update progress if bookId is provided
      if (bookId && embeddingsCache[bookId]) {
        const processedChunks = i + index + 1;
        embeddingsCache[bookId].progress = {
          processedChunks,
          totalChunks: chunks.length
        };
        
        // Emit progress event
        embeddingsProgressEmitter.emit('progress', {
          bookId,
          processedChunks: processedChunks,
          totalChunks: chunks.length,
          exactWordCount: embeddingsCache[bookId].progress?.exactWordCount || calculateWordCount(bookId),
          exactTokenCount: embeddingsCache[bookId].progress?.exactTokenCount || Math.round((embeddingsCache[bookId].progress?.exactWordCount || calculateWordCount(bookId)) * 0.75)
        });
      }
      
      return response.data[0].embedding;
    });
    
    // Wait for all embeddings in this batch
    const batchResults = await Promise.all(batchPromises);
    embeddings.push(...batchResults);
  }
  
  return embeddings;
}

/**
 * Process a book's content into chunks and embeddings
 */
export async function processBookContent(
  bookId: number, 
  content: string,
  userId?: number,
  forceRefresh: boolean = false
): Promise<void> {
  console.log(`Processing book ${bookId} with content length ${content.length}`);
  
  // Check if we already have embeddings for this book
  if (!forceRefresh && embeddingsCache[bookId] && !embeddingsCache[bookId].isProcessing) {
    console.log(`Using cached embeddings for book ${bookId}`);
    
    // Even with cached embeddings, emit a progress event to update UI
    embeddingsProgressEmitter.emit('progress', {
      bookId,
      processedChunks: 1,
      totalChunks: 1,
      exactWordCount: embeddingsCache[bookId].progress?.exactWordCount || calculateWordCount(bookId),
      exactTokenCount: embeddingsCache[bookId].progress?.exactTokenCount || Math.round((embeddingsCache[bookId].progress?.exactWordCount || calculateWordCount(bookId)) * 0.75)
    });
    
    return;
  }
  
  // Mark as processing to avoid duplicate processing
  if (!embeddingsCache[bookId]) {
    console.log(`Initializing embeddings cache for book ${bookId}`);
    // Calculate approximate word and token counts from the original content
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    const tokenCount = Math.round(wordCount * 0.75);
    console.log(`Book ${bookId} has approximately ${wordCount} words and ${tokenCount} tokens`);
    
    embeddingsCache[bookId] = {
      chunks: [],
      embeddings: [],
      isProcessing: true,
      progress: { 
        processedChunks: 0, 
        totalChunks: 0,
        exactWordCount: wordCount,
        exactTokenCount: tokenCount
      }
    };
  } else {
    console.log(`Updating existing embedding cache entry for book ${bookId}`);
    embeddingsCache[bookId].isProcessing = true;
    
    // Preserve existing word and token counts if available, or calculate them
    const existingWordCount = embeddingsCache[bookId].progress?.exactWordCount;
    const existingTokenCount = embeddingsCache[bookId].progress?.exactTokenCount;
    
    // Calculate new counts if they don't exist
    const wordCount = existingWordCount || content.split(/\s+/).filter(word => word.length > 0).length;
    const tokenCount = existingTokenCount || Math.round(wordCount * 0.75);
    
    console.log(`Using word count: ${wordCount}, token count: ${tokenCount} for book ${bookId}`);
    
    embeddingsCache[bookId].progress = { 
      processedChunks: 0, 
      totalChunks: 0,
      exactWordCount: wordCount,
      exactTokenCount: tokenCount
    };
  }
  
  try {
    console.log(`Processing book ${bookId} for embeddings (${content.length} characters)`);
    
    // Ensure we have content to process
    if (!content || content.length === 0) {
      console.error(`Book ${bookId} has no content to process`);
      throw new Error('No content provided for embedding');
    }
    
    // Split content into chunks
    const chunks = chunkText(content);
    console.log(`Chunked book ${bookId} into ${chunks.length} chunks`);
    
    // Calculate approximate word and token counts from the original content
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    const tokenCount = Math.round(wordCount * 0.75);
    console.log(`Book ${bookId} has approximately ${wordCount} words and ${tokenCount} tokens`);
    
    // Initialize progress
    embeddingsCache[bookId].progress = {
      processedChunks: 0,
      totalChunks: chunks.length,
      exactWordCount: wordCount,
      exactTokenCount: tokenCount
    };
    
    // Emit initial progress event
    embeddingsProgressEmitter.emit('progress', {
      bookId,
      processedChunks: 0,
      totalChunks: chunks.length,
      exactWordCount: wordCount,
      exactTokenCount: tokenCount
    });
    
    // Generate embeddings
    const embeddings = await generateEmbeddings(chunks, userId, bookId);
    
    // Cache the results
    embeddingsCache[bookId] = {
      chunks,
      embeddings,
      isProcessing: false,
      progress: {
        processedChunks: chunks.length,
        totalChunks: chunks.length,
        exactWordCount: wordCount,
        exactTokenCount: tokenCount
      }
    };
    
    // Emit completion event
    embeddingsProgressEmitter.emit('progress', {
      bookId,
      processedChunks: chunks.length,
      totalChunks: chunks.length,
      exactWordCount: wordCount,
      exactTokenCount: tokenCount
    });
    
    console.log(`Processing complete for book ${bookId} - final word count: ${wordCount}, token count: ${tokenCount}`);
  } catch (error) {
    console.error(`Error processing embeddings for book ${bookId}:`, error);
    // Make sure to mark as not processing even if there's an error
    if (embeddingsCache[bookId]) {
      embeddingsCache[bookId].isProcessing = false;
      
      // Emit an error progress event
      embeddingsProgressEmitter.emit('progress', {
        bookId,
        processedChunks: -1,
        totalChunks: -1,
        exactWordCount: embeddingsCache[bookId]?.progress?.exactWordCount || 0,
        exactTokenCount: embeddingsCache[bookId]?.progress?.exactTokenCount || 0
      });
    }
    throw error;
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
 * Find the most relevant chunks for a query
 */
export async function findRelevantChunks(
  bookId: number,
  query: string,
  userId?: number,
  maxChunks: number = 5
): Promise<string[]> {
  // Check if we have processed this book
  if (!embeddingsCache[bookId]) {
    throw new Error(`Book ${bookId} has not been processed for embeddings yet`);
  }
  
  // Get query embedding
  const openai = await getOpenAIClient(userId);
  const queryEmbeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
    dimensions: 1536
  });
  
  const queryEmbedding = queryEmbeddingResponse.data[0].embedding;
  
  // Get book embeddings
  const { chunks, embeddings } = embeddingsCache[bookId];
  
  // Calculate similarities
  const similarities = embeddings.map(embedding => 
    cosineSimilarity(embedding, queryEmbedding)
  );
  
  // Find indices of top chunks
  const indices = similarities
    .map((similarity, index) => ({ similarity, index }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxChunks)
    .map(item => item.index);
  
  // Return the relevant chunks
  return indices.map(index => chunks[index]);
}

/**
 * Clear embeddings cache for a specific book or all books
 */
export function clearEmbeddingsCache(bookId?: number): void {
  if (bookId) {
    delete embeddingsCache[bookId];
    console.log(`Cleared embeddings cache for book ${bookId}`);
  } else {
    Object.keys(embeddingsCache).forEach(key => {
      delete embeddingsCache[parseInt(key)];
    });
    console.log('Cleared all embeddings from cache');
  }
}