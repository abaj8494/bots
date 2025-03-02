import express, { Request, Response, Router, NextFunction, RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { auth } from '../middleware/auth';
import { createUser, getUserByEmail, saveApiKey, getApiKeyByUserId, updateApiKey, updateUserVerificationStatus, saveVerificationToken, getVerificationToken, User } from '../models/User';
import { sendVerificationEmail } from '../utils/email';
import crypto from 'crypto';
import passport from 'passport';

// Extend the Express.Request interface to include our user type
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
    }
  }
}

const router: Router = express.Router();

// @route   POST api/auth/register
// @desc    Register a user
// @access  Public
router.post('/register', (async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ msg: 'User already exists' });
    }
    
    // Create new user with verified status set to false
    const newUser = await createUser({ 
      username, 
      email, 
      password,
      is_verified: false 
    });
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Save verification token to database
    await saveVerificationToken({
      user_id: newUser.id as number,
      token: verificationToken,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });
    
    // Send verification email
    await sendVerificationEmail(email, verificationToken, newUser.id as number);
    
    // Return success message
    res.status(201).json({ 
      msg: 'Registration successful! Please check your email to verify your account.' 
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
}) as RequestHandler);

// @route   GET api/auth/verify/:userId/:token
// @desc    Verify user's email
// @access  Public
router.get('/verify/:userId/:token', (async (req: Request, res: Response) => {
  try {
    const { userId, token } = req.params;
    
    // Find verification token
    const verificationRecord = await getVerificationToken(parseInt(userId), token);
    
    if (!verificationRecord) {
      return res.status(400).json({ msg: 'Invalid or expired verification link' });
    }
    
    // Check if token has expired
    if (new Date() > new Date(verificationRecord.expires_at)) {
      return res.status(400).json({ msg: 'Verification link has expired' });
    }
    
    // Update user's verification status
    await updateUserVerificationStatus(parseInt(userId), true);
    
    // Create JWT payload
    const user = await getUserByEmail(verificationRecord.user_email);
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email
    };
    
    // Sign token
    jwt.sign(
      payload,
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        
        // Redirect to frontend with token
        res.redirect(`${process.env.CLIENT_URL}?token=${token}`);
      }
    );
  } catch (err) {
    console.error('Email verification error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
}) as RequestHandler);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', (async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    // Check if user exists
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    
    // Check if user is verified
    if (!user.is_verified) {
      return res.status(401).json({ msg: 'Please verify your email before logging in' });
    }
    
    // Create JWT payload
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email
    };
    
    // Sign token
    jwt.sign(
      payload,
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
}) as RequestHandler);

// @route   GET api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, ((req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ msg: 'User not authenticated' });
    }
    res.json(req.user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
}) as RequestHandler);

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  ((req: Request, res: Response) => {
    // Create JWT token
    if (!req.user) {
      return res.status(401).json({ msg: 'Authentication failed' });
    }
    
    const payload = {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email
    };
    
    jwt.sign(
      payload,
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.redirect(`${process.env.CLIENT_URL}?token=${token}`);
      }
    );
  }) as RequestHandler
);

// GitHub OAuth routes
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get(
  '/github/callback',
  passport.authenticate('github', { session: false }),
  ((req: Request, res: Response) => {
    // Create JWT token
    if (!req.user) {
      return res.status(401).json({ msg: 'Authentication failed' });
    }
    
    const payload = {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email
    };
    
    jwt.sign(
      payload,
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.redirect(`${process.env.CLIENT_URL}?token=${token}`);
      }
    );
  }) as RequestHandler
);

// @route   POST api/auth/apikey
// @desc    Save or update user's OpenAI API key
// @access  Private
router.post('/apikey', auth, (async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: 'User not authenticated' });
    }
    
    const userId = req.user.id;
    
    // Check if user already has an API key
    const existingApiKey = await getApiKeyByUserId(userId);
    
    let result;
    if (existingApiKey) {
      // Update existing API key
      result = await updateApiKey(userId, apiKey);
    } else {
      // Save new API key
      result = await saveApiKey({
        user_id: userId,
        api_key: apiKey,
        is_active: true
      });
    }
    
    res.json({ msg: 'API key saved successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
}) as RequestHandler);

// @route   GET api/auth/apikey
// @desc    Check if user has an API key
// @access  Private
router.get('/apikey', auth, (async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ msg: 'User not authenticated' });
    }
    
    const apiKey = await getApiKeyByUserId(userId);
    
    if (apiKey) {
      res.json({ hasApiKey: true });
    } else {
      res.json({ hasApiKey: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
}) as RequestHandler);

export default router; 