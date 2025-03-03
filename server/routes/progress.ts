import express, { Request, Response, Router } from 'express';

/**
 * This interface defines the shape of our in-memory progress data.
 * Adapt it as needed for your real-world use (database, job queue, etc.).
 */
interface EmbeddingProgress {
  processedChunks: number;
  totalChunks: number;
  exactWordCount: number;
  exactTokenCount: number;
}

/**
 * Example in-memory store of progress.
 * In a real app, you might query a database, or some service that tracks chunk processing status.
 */
let embeddingProgress: EmbeddingProgress = {
  processedChunks: 0,
  totalChunks: 50,
  exactWordCount: 45000,
  exactTokenCount: 36000,
};

const router: Router = express.Router();

/**
 * GET /api/progress
 * Returns the current progress data for your loading circle or any other client usage.
 */
router.get('/', (_req: Request, res: Response) => {
  // Respond with our in-memory embeddingProgress object
  return res.json(embeddingProgress);
});

/**
 * POST /api/progress
 * (Optional) Update progress as your background job runs.
 * In a real scenario, your chunk-embedding code might call this
 * or you can wire it up differently as you wish.
 */
router.post('/', (req: Request, res: Response) => {
  // Example logic: parse from req.body if you want dynamic updates
  // const { processedChunks, totalChunks, exactWordCount, exactTokenCount } = req.body;
  // embeddingProgress = { processedChunks, totalChunks, exactWordCount, exactTokenCount };

  // Here, we just do a hard-coded increment and changes for demonstration
  embeddingProgress.processedChunks += 5;
  embeddingProgress.exactWordCount += 1000;
  embeddingProgress.exactTokenCount += 750;

  return res.json({ success: true, updatedProgress: embeddingProgress });
});

/**
 * GET /api/progress/:id
 * For situations where you might want to track multiple books or multiple users,
 * you can read :id from req.params.id. Currently, we just ignore the ID and
 * return the same embeddingProgress object, but you can expand this logic to handle
 * separate progress objects keyed by the ID.
 */
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  return res.json({
    info: `Here is the progress for ID = ${id}`,
    embeddingProgress,
  });
});

export default router; 