import express, { Request, Response, Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { auth } from '../middleware/auth';
import { createUser, getUserByEmail, saveApiKey, getApiKeyByUserId, updateApiKey } from '../models/User';

const router: Router = express.Router();

// @route   POST api/auth/register
// @desc    Register a user
// @access  Public
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ msg: 'User already exists' });
    }
    
    // Create new user
    const newUser = await createUser({ username, email, password });
    
    // Create JWT payload
    const payload = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email
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
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req: Request, res: Response) => {
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
});

// @route   GET api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req: Request, res: Response) => {
  try {
    res.json(req.user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST api/auth/apikey
// @desc    Save or update user's OpenAI API key
// @access  Private
router.post('/apikey', auth, async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ msg: 'User not authenticated' });
    }
    
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
});

// @route   GET api/auth/apikey
// @desc    Check if user has an API key
// @access  Private
router.get('/apikey', auth, async (req: Request, res: Response) => {
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
});

export default router; 