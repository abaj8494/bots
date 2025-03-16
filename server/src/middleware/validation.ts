import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';

// Validation middleware for username
// Ensures username is under 24 characters, only contains letters, numbers, and underscores
export const validateUsername = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 24 }) // Updated to max 24 characters
    .withMessage('Username must be between 3 and 24 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  // Middleware to check validation results
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Validation middleware for registration
export const validateRegistration = [
  ...validateUsername,
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
]; 