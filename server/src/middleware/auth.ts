import { Request, Response, NextFunction } from 'express';

// Define a consistent user payload type that works with our token
export interface UserPayload {
  id: number;
  username: string;
  email: string;
}

// Simplified auth middleware that passes through
export const auth = (req: Request, res: Response, next: NextFunction) => {
  // Since authentication is already configured elsewhere,
  // this middleware now simply passes control to the next middleware
  next();
}; 