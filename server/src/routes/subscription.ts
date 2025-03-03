import express, { Request, Response, Router } from 'express';
import { auth } from '../middleware/auth';
import { createUserSubscription, getUserSubscription, cancelUserSubscription, getUserById } from '../models/User';
import stripe from '../config/stripe';
import dotenv from 'dotenv';

dotenv.config();

const router: Router = express.Router();

// Constants
const PREMIUM_PRICE = 2.99;
const PREMIUM_CURRENCY = 'AUD';
const PREMIUM_PRICE_CENTS = Math.round(PREMIUM_PRICE * 100); // Stripe uses cents

// @route   GET api/subscription
// @desc    Get current subscription status
// @access  Private
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      res.status(401).json({ msg: 'User not authenticated' });
      return;
    }
    
    const userId = req.user.id;
    
    // Get current subscription
    const subscription = await getUserSubscription(userId);
    
    // Return subscription details or default free tier
    if (subscription) {
      res.json({
        tier: subscription.tier,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
        isActive: subscription.is_active,
        amount: subscription.amount,
        currency: subscription.currency
      });
    } else {
      res.json({
        tier: 'free',
        isActive: true
      });
    }
  } catch (err) {
    console.error('Error getting subscription:', err);
    res.status(500).json({ msg: 'Server error getting subscription details' });
  }
});

// @route   POST api/subscription/create-checkout-session
// @desc    Create a Stripe checkout session for premium upgrade
// @access  Private
router.post('/create-checkout-session', auth, async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      res.status(401).json({ msg: 'User not authenticated' });
      return;
    }
    
    const userId = req.user.id;
    
    // Check if already subscribed
    const existingSubscription = await getUserSubscription(userId);
    if (existingSubscription && existingSubscription.tier === 'premium' && existingSubscription.is_active) {
      res.status(400).json({ msg: 'Already subscribed to premium tier' });
      return;
    }
    
    // Get user details for the checkout session
    const user = await getUserById(userId);
    if (!user) {
      res.status(404).json({ msg: 'User not found' });
      return;
    }
    
    // Create a Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: PREMIUM_CURRENCY.toLowerCase(),
            product_data: {
              name: 'BookBot Premium Subscription',
              description: 'Upgrade to premium tier with 300 queries per day',
            },
            unit_amount: PREMIUM_PRICE_CENTS,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/subscription/cancel`,
      customer_email: user.email,
      client_reference_id: userId.toString(),
      metadata: {
        userId: userId.toString(),
        tier: 'premium'
      }
    });
    
    // Return the session ID to the client
    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    res.status(500).json({ msg: 'Server error creating checkout session' });
  }
});

// @route   POST api/subscription/success
// @desc    Handle successful checkout payment
// @access  Private
router.post('/success', auth, async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      res.status(401).json({ msg: 'User not authenticated' });
      return;
    }
    
    const userId = req.user.id;
    const { sessionId } = req.body;
    
    if (!sessionId) {
      res.status(400).json({ msg: 'Session ID is required' });
      return;
    }
    
    // Verify the checkout session with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (!session || session.payment_status !== 'paid') {
      res.status(400).json({ msg: 'Payment not completed' });
      return;
    }
    
    // Verify that this session is for the correct user
    if (session.client_reference_id !== userId.toString() && 
        session.metadata?.userId !== userId.toString()) {
      res.status(403).json({ msg: 'Unauthorized session' });
      return;
    }
    
    // Create new subscription
    const subscription = await createUserSubscription({
      user_id: userId,
      tier: 'premium',
      amount: PREMIUM_PRICE,
      currency: PREMIUM_CURRENCY
    });
    
    res.json({
      msg: 'Subscription upgraded successfully',
      tier: subscription.tier,
      startDate: subscription.start_date,
      isActive: subscription.is_active,
      amount: subscription.amount,
      currency: subscription.currency
    });
  } catch (err) {
    console.error('Error processing successful payment:', err);
    res.status(500).json({ msg: 'Server error processing payment' });
  }
});

// @route   POST api/subscription/cancel
// @desc    Cancel current subscription
// @access  Private
router.post('/cancel', auth, async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      res.status(401).json({ msg: 'User not authenticated' });
      return;
    }
    
    const userId = req.user.id;
    
    // Cancel existing subscription
    const cancelledSubscription = await cancelUserSubscription(userId);
    
    if (!cancelledSubscription) {
      res.status(400).json({ msg: 'No active subscription to cancel' });
      return;
    }
    
    res.json({
      msg: 'Subscription cancelled successfully',
      subscription: {
        tier: cancelledSubscription.tier,
        endDate: cancelledSubscription.end_date,
        isActive: false
      }
    });
  } catch (err) {
    console.error('Error cancelling subscription:', err);
    res.status(500).json({ msg: 'Server error cancelling subscription' });
  }
});

export default router; 