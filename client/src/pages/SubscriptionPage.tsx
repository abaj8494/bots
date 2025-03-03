import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';

interface Subscription {
  tier: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  amount?: number;
  currency?: string;
}

const SubscriptionPage: React.FC = () => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get current subscription status
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        if (!token) {
          navigate('/login');
          return;
        }
        
        const response = await axios.get(`${API_URL}/api/subscription`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        setSubscription(response.data);
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching subscription:', err);
        setError(err.response?.data?.msg || 'Failed to load subscription details');
        setLoading(false);
      }
    };
    
    fetchSubscription();
  }, [navigate]);
  
  // Check for success query param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sessionId = params.get('session_id');
    
    if (sessionId && subscription?.tier !== 'premium') {
      handleSubscriptionSuccess(sessionId);
    }
  }, [location.search, subscription, navigate]);
  
  // Handle successful payment
  const handleSubscriptionSuccess = async (sessionId: string) => {
    try {
      setProcessingPayment(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        navigate('/login');
        return;
      }
      
      await axios.post(
        `${API_URL}/api/subscription/success`,
        { sessionId },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      // Refresh subscription
      const response = await axios.get(`${API_URL}/api/subscription`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setSubscription(response.data);
      setProcessingPayment(false);
    } catch (err: any) {
      console.error('Error processing payment:', err);
      setError(err.response?.data?.msg || 'Failed to process payment');
      setProcessingPayment(false);
    }
  };
  
  // Handle upgrade button click
  const handleUpgrade = async () => {
    try {
      setProcessingPayment(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        navigate('/login');
        return;
      }
      
      const response = await axios.post(
        `${API_URL}/api/subscription/create-checkout-session`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      // Redirect to Stripe checkout
      window.location.href = response.data.url;
    } catch (err: any) {
      console.error('Error creating checkout session:', err);
      setError(err.response?.data?.msg || 'Failed to start checkout process');
      setProcessingPayment(false);
    }
  };
  
  // Handle cancel subscription
  const handleCancel = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        navigate('/login');
        return;
      }
      
      await axios.post(
        `${API_URL}/api/subscription/cancel`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      // Refresh subscription
      const response = await axios.get(`${API_URL}/api/subscription`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setSubscription(response.data);
      setLoading(false);
    } catch (err: any) {
      console.error('Error cancelling subscription:', err);
      setError(err.response?.data?.msg || 'Failed to cancel subscription');
      setLoading(false);
    }
  };
  
  if (loading || processingPayment) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Subscription</h1>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Subscription</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Your Subscription</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free Tier */}
        <div className={`border rounded-lg p-6 ${subscription?.tier === 'free' ? 'border-blue-500 shadow-lg' : 'border-gray-200'}`}>
          <h2 className="text-xl font-semibold mb-2">Free Tier</h2>
          <p className="text-gray-600 mb-4">Basic access with limited queries</p>
          <ul className="mb-6 space-y-2">
            <li className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Up to 20 queries per day
            </li>
            <li className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Access to all public domain books
            </li>
          </ul>
          <p className="text-xl font-bold mb-4">Free</p>
          
          {subscription?.tier === 'premium' && (
            <button 
              className="w-full py-2 px-4 bg-gray-200 text-gray-600 rounded-lg"
              disabled
            >
              Current Plan
            </button>
          )}
        </div>
        
        {/* Premium Tier */}
        <div className={`border rounded-lg p-6 ${subscription?.tier === 'premium' ? 'border-blue-500 shadow-lg' : 'border-gray-200'}`}>
          <h2 className="text-xl font-semibold mb-2">Premium Tier</h2>
          <p className="text-gray-600 mb-4">Enhanced access with more queries</p>
          <ul className="mb-6 space-y-2">
            <li className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Up to 300 queries per day
            </li>
            <li className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Access to all public domain books
            </li>
            <li className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Priority support
            </li>
          </ul>
          <p className="text-xl font-bold mb-4">$2.99 AUD</p>
          
          {subscription?.tier === 'free' ? (
            <button 
              className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              onClick={handleUpgrade}
            >
              Upgrade to Premium
            </button>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Active since: {new Date(subscription?.startDate || '').toLocaleDateString()}
              </p>
              <button 
                className="w-full py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                onClick={handleCancel}
              >
                Cancel Subscription
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Current plan information */}
      <div className="mt-8 p-6 border border-gray-200 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Current Plan: {subscription?.tier === 'premium' ? 'Premium' : 'Free'}</h2>
        {subscription?.tier === 'premium' && (
          <div>
            <p>Your premium subscription gives you up to 300 queries per day.</p>
            <p className="mt-2">
              Subscription active since: {new Date(subscription?.startDate || '').toLocaleDateString()}
            </p>
          </div>
        )}
        {subscription?.tier === 'free' && (
          <div>
            <p>You are currently on the free plan with a limit of 20 queries per day.</p>
            <p className="mt-2">Upgrade to Premium to increase your daily limit to 300 queries.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionPage; 