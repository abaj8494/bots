import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Define a consistent user payload type that works with our token
export interface UserPayload {
  id: number;
  username: string;
  email: string;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

// Auth middleware that validates JWT tokens
export const auth = (req: Request, res: Response, next: NextFunction): void => {
  console.log('Auth middleware called');
  
  // Get token from header
  const authHeader = req.header('Authorization');
  console.log('Auth header:', authHeader);
  
  // Extract token
  const token = authHeader?.split(' ')[1]; // Bearer TOKEN
  
  // Check if no token
  if (!token) {
    console.log('No token found');
    res.status(401).json({ msg: 'No token, authorization denied' });
    return;
  }
  
  try {
    // Verify token
    const secret = process.env.JWT_SECRET || 'default_jwt_secret';
    console.log('Verifying token with secret:', secret.substring(0, 10) + '...');
    
    const decoded = jwt.verify(token, secret) as UserPayload;
    console.log('Token verified successfully, user:', decoded);
    
    // Set user from payload
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification failed:', err);
    res.status(401).json({ msg: 'Token is not valid' });
  }
}; 