import express from 'express';
import cors from 'cors';
import progressRouter from './routes/progress.js';

const app = express();

// If you expect JSON from POST bodies, ensure you have this:
app.use(express.json());

// Proper CORS configuration for credentials
app.use(cors({
  origin: ['https://abaj.cloud', 'https://api.abaj.cloud'], // Allow both domains
  credentials: true,  // Allow credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// The progress endpoint
app.use('/api/progress', progressRouter);

app.listen(3001, () => {
  console.log('Server listening on port 3001');
}); 