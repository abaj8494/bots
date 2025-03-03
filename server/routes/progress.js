import express from 'express';
const router = express.Router();

/**
 * Example in-memory store of progress. In a real app, you might fetch these from a database,
 * or update them as you process text in a background job.
 */
let embeddingProgress = {
  processedChunks: 0,
  totalChunks: 50,
  exactWordCount: 45000,
  exactTokenCount: 36000,
};

/**
 * GET /api/progress
 * Returns the current progress data for your loading circle or any other client usage.
 */
router.get('/', (req, res) => {
  // Respond with our in-memory embeddingProgress object
  res.json(embeddingProgress);
});

/**
 * POST /api/progress
 * (Optional) Update progress as your background job runs.
 * In a real scenario, your chunk-embedding code might call this
 * or you can wire it up differently.
 */
router.post('/', (req, res) => {
  // Example logic: parse from req.body if you want dynamic updates
  // const { processedChunks, totalChunks, exactWordCount, exactTokenCount } = req.body;
  // embeddingProgress = { processedChunks, totalChunks, exactWordCount, exactTokenCount };

  // Here, we just do a hard-coded increment for demonstration
  embeddingProgress.processedChunks += 5;
  embeddingProgress.exactWordCount += 1000;
  embeddingProgress.exactTokenCount += 750;

  res.json({ success: true, updatedProgress: embeddingProgress });
});

/**
 * GET /api/progress/:id
 * For situations where you might want to track multiple books or multiple users,
 * you can read :id from req.params.id. Currently, we just ignore the ID and
 * return the same embeddingProgress object, but you can expand this logic to handle
 * separate progress objects keyed by the ID.
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  // Return the same object for now or implement logic to handle the ID
  res.json({
    info: `Here is the progress for ID = ${id}`,
    embeddingProgress,
  });
});

export default router; 