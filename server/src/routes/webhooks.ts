import { Request, Response } from 'express';
import stripe from '../config/stripe';
import { createUserSubscription } from '../models/User';

// Constants
const PREMIUM_PRICE = 2.99;
const PREMIUM_CURRENCY = 'AUD';

/**
 * Handle Stripe webhook events
 */
export const handleStripeWebhook = (req: Request, res: Response): void => {
  const sig = req.headers['stripe-signature'] as string;
  
  if (!sig) {
    res.status(400).send('Missing Stripe signature');
    return;
  }
  
  let event;
  
  try {
    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    res.status(400).send(`Webhook signature verification failed: ${err.message}`);
    return;
  }
  
  // Handle different types of events
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        handleCheckoutSessionCompleted(event.data.object)
          .then(() => {
            console.log('Successfully processed checkout.session.completed event');
          })
          .catch(err => {
            console.error('Failed to process checkout.session.completed event:', err);
          });
        break;
        
      // Handle other event types as needed
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    // Return a response to acknowledge receipt of the event
    res.status(200).send({ received: true });
  } catch (err) {
    console.error(`Error handling webhook: ${err}`);
    res.status(500).send('Webhook handler failed');
  }
};

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutSessionCompleted(session: any): Promise<void> {
  if (session.payment_status === 'paid') {
    // Extract user ID from metadata
    const userId = parseInt(session.metadata.userId);
    
    if (!userId || isNaN(userId)) {
      console.error('Invalid user ID in session metadata');
      return;
    }
    
    // Create subscription
    await createUserSubscription({
      user_id: userId,
      tier: 'premium',
      amount: PREMIUM_PRICE,
      currency: PREMIUM_CURRENCY
    });
    
    console.log(`Successfully created subscription for user ${userId}`);
  }
} 