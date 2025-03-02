import OpenAI from 'openai';
import { getOpenAIClient } from './openai';

// In-memory cache for embeddings
// Structure: { bookId: { chunks: string[], embeddings: number[][] } }
type EmbeddingsCache = Record<number, {
  chunks: string[];
  embeddings: number[][];
}>;

const embeddingsCache: EmbeddingsCache = {};

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
  userId?: number
): Promise<number[][]> {
  const openai = await getOpenAIClient(userId);
  const embeddings: number[][] = [];
  
  // Process chunks in batches to avoid rate limits
  const batchSize = 20; // Adjust based on API limits
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batchChunks = chunks.slice(i, i + batchSize);
    console.log(`Generating embeddings for batch ${i/batchSize + 1} of ${Math.ceil(chunks.length/batchSize)}`);
    
    // Create embeddings for this batch
    const batchPromises = batchChunks.map(async (chunk) => {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk,
        dimensions: 1536 // Standard for this model
      });
      
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
  // Check if we already have embeddings for this book
  if (!forceRefresh && embeddingsCache[bookId]) {
    console.log(`Using cached embeddings for book ${bookId}`);
    return;
  }
  
  console.log(`Processing book ${bookId} for embeddings (${content.length} characters)`);
  
  // Split content into chunks
  const chunks = chunkText(content);
  console.log(`Book split into ${chunks.length} chunks`);
  
  // Generate embeddings
  const embeddings = await generateEmbeddings(chunks, userId);
  
  // Cache the results
  embeddingsCache[bookId] = {
    chunks,
    embeddings
  };
  
  console.log(`Successfully processed and cached embeddings for book ${bookId}`);
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