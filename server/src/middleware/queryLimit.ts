import { Request, Response, NextFunction } from 'express';
import { getDailyQueryCount, incrementQueryCount, getUserSubscription } from '../models/User';

// Define constants for query limits
const FREE_TIER_LIMIT = 20;
const PREMIUM_TIER_LIMIT = 300;

/**
 * Middleware to check and enforce daily query limits based on subscription tier
 */
export const checkQueryLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Skip for non-authenticated users (though auth middleware should catch this)
    if (!req.user || !req.user.id) {
      res.status(401).json({ msg: 'Not authenticated' });
      return;
    }
    
    const userId = req.user.id;
    
    // Get current daily query count
    const currentCount = await getDailyQueryCount(userId);
    
    // Get user subscription status
    const subscription = await getUserSubscription(userId);
    
    // Determine query limit based on subscription tier
    const queryLimit = subscription && subscription.tier === 'premium' 
      ? PREMIUM_TIER_LIMIT 
      : FREE_TIER_LIMIT;
    
    // Check if user has exceeded their limit
    if (currentCount >= queryLimit) {
      // If on free tier, suggest upgrading
      if (!subscription || subscription.tier !== 'premium') {
        res.status(429).json({ 
          msg: 'Daily query limit reached', 
          limit: queryLimit,
          count: currentCount,
          upgrade: true,
          subscription: {
            tier: 'free',
            limit: FREE_TIER_LIMIT,
            upgradePrice: 2.99,
            upgradeCurrency: 'AUD',
            upgradeTier: 'premium',
            upgradeLimit: PREMIUM_TIER_LIMIT
          }
        });
      } else {
        // Premium user who reached their limit
        res.status(429).json({ 
          msg: 'Daily query limit reached', 
          limit: queryLimit,
          count: currentCount,
          subscription: {
            tier: 'premium',
            limit: PREMIUM_TIER_LIMIT
          }
        });
      }
      return;
    }
    
    // Increment the query count
    await incrementQueryCount(userId);
    
    // Proceed to the next middleware
    next();
  } catch (err) {
    console.error('Error checking query limit:', err);
    res.status(500).json({ msg: 'Server error checking query limit' });
  }
}; 