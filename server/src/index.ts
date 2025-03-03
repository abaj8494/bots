import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import passport from 'passport';
import { configurePassport } from './config/passport';

// Import routes
import authRoutes from './routes/auth';
import booksRoutes from './routes/books';
import chatRoutes from './routes/chat';
import embeddingRoutes from './routes/embedding';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// Proper CORS configuration for credentials
app.use(cors({
  origin: ['https://abaj.cloud', 'https://api.abaj.cloud'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
// Initialize Passport
app.use(passport.initialize());
// Configure Passport strategies
configurePassport();
// Serve static files from public directory
app.use('/static', express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/embeddings', embeddingRoutes);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../../client/build')));

  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, '../../client/build', 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 