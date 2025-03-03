import db from '../config/db';
import bcrypt from 'bcrypt';

export interface User {
  id?: number;
  username: string;
  email: string;
  password: string;
  created_at?: Date;
  is_verified?: boolean;
  daily_query_count?: number;
  last_query_date?: Date;
}

interface UserApiKey {
  id?: number;
  user_id: number;
  api_key: string;
  is_active: boolean;
  created_at?: Date;
}

interface VerificationToken {
  id?: number;
  user_id: number;
  token: string;
  expires_at: Date;
  created_at?: Date;
  user_email?: string;
}

interface UserSubscription {
  id?: number;
  user_id: number;
  tier: 'free' | 'premium';
  amount?: number;
  currency?: string;
  start_date?: Date;
  end_date?: Date;
  is_active?: boolean;
  created_at?: Date;
}

export const createUser = async (userData: User) => {
  const { username, email, password, is_verified = false } = userData;
  
  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  
  const query = `
    INSERT INTO users (username, email, password, is_verified)
    VALUES ($1, $2, $3, $4)
    RETURNING id, username, email, created_at, is_verified
  `;
  
  const result = await db.query(query, [username, email, hashedPassword, is_verified]);
  return result.rows[0];
};

export const getUserByEmail = async (email: string) => {
  const query = 'SELECT * FROM users WHERE email = $1';
  const result = await db.query(query, [email]);
  return result.rows[0];
};

export const getUserById = async (id: number) => {
  const query = 'SELECT id, username, email, created_at, is_verified FROM users WHERE id = $1';
  const result = await db.query(query, [id]);
  return result.rows[0];
};

export const saveApiKey = async (userApiKey: UserApiKey) => {
  const { user_id, api_key } = userApiKey;
  
  const query = `
    INSERT INTO user_api_keys (user_id, api_key)
    VALUES ($1, $2)
    RETURNING id, user_id, api_key, is_active, created_at
  `;
  
  const result = await db.query(query, [user_id, api_key]);
  return result.rows[0];
};

export const getApiKeyByUserId = async (userId: number) => {
  const query = 'SELECT * FROM user_api_keys WHERE user_id = $1 AND is_active = true';
  const result = await db.query(query, [userId]);
  return result.rows[0];
};

export const updateApiKey = async (userId: number, apiKey: string) => {
  const query = `
    UPDATE user_api_keys
    SET api_key = $1
    WHERE user_id = $2
    RETURNING id, user_id, api_key, is_active, created_at
  `;
  
  const result = await db.query(query, [apiKey, userId]);
  return result.rows[0];
};

// Verification-related functions

export const updateUserVerificationStatus = async (userId: number, isVerified: boolean) => {
  const query = `
    UPDATE users
    SET is_verified = $1
    WHERE id = $2
    RETURNING id, username, email, is_verified
  `;
  
  const result = await db.query(query, [isVerified, userId]);
  return result.rows[0];
};

export const saveVerificationToken = async (verificationData: VerificationToken) => {
  const { user_id, token, expires_at } = verificationData;
  
  // First, get the user's email for later use
  const user = await getUserById(user_id);
  
  const query = `
    INSERT INTO verification_tokens (user_id, token, expires_at)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, token, expires_at, created_at
  `;
  
  const result = await db.query(query, [user_id, token, expires_at]);
  
  // Add the user's email to the result for convenience
  return { ...result.rows[0], user_email: user.email };
};

export const getVerificationToken = async (userId: number, token: string) => {
  const query = `
    SELECT vt.*, u.email as user_email
    FROM verification_tokens vt
    JOIN users u ON vt.user_id = u.id
    WHERE vt.user_id = $1 AND vt.token = $2
  `;
  
  const result = await db.query(query, [userId, token]);
  return result.rows[0];
};

// Query limit and subscription functions

export const resetDailyQueryCount = async (userId: number) => {
  const query = `
    UPDATE users
    SET daily_query_count = 0, last_query_date = CURRENT_DATE
    WHERE id = $1
    RETURNING id, username, email, daily_query_count, last_query_date
  `;
  
  const result = await db.query(query, [userId]);
  return result.rows[0];
};

export const incrementQueryCount = async (userId: number) => {
  // First check if we need to reset the counter (new day)
  const checkQuery = `
    SELECT id, daily_query_count, last_query_date
    FROM users
    WHERE id = $1
  `;
  
  const checkResult = await db.query(checkQuery, [userId]);
  const user = checkResult.rows[0];
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // If it's a new day, reset the counter
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const lastQueryDate = new Date(user.last_query_date).toISOString().split('T')[0];
  
  if (today !== lastQueryDate) {
    return resetDailyQueryCount(userId);
  }
  
  // Otherwise increment the counter
  const query = `
    UPDATE users
    SET daily_query_count = daily_query_count + 1
    WHERE id = $1
    RETURNING id, username, email, daily_query_count, last_query_date
  `;
  
  const result = await db.query(query, [userId]);
  return result.rows[0];
};

export const getDailyQueryCount = async (userId: number) => {
  // Check if we need to reset the counter (new day)
  const checkQuery = `
    SELECT id, daily_query_count, last_query_date
    FROM users
    WHERE id = $1
  `;
  
  const checkResult = await db.query(checkQuery, [userId]);
  const user = checkResult.rows[0];
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // If it's a new day, reset the counter
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const lastQueryDate = new Date(user.last_query_date).toISOString().split('T')[0];
  
  if (today !== lastQueryDate) {
    return 0; // Will be reset when incrementQueryCount is called
  }
  
  return user.daily_query_count;
};

export const getUserSubscription = async (userId: number) => {
  const query = `
    SELECT *
    FROM user_subscriptions
    WHERE user_id = $1 AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1
  `;
  
  const result = await db.query(query, [userId]);
  return result.rows[0];
};

export const createUserSubscription = async (subscription: UserSubscription) => {
  const { user_id, tier, amount, currency = 'AUD' } = subscription;
  
  // First deactivate any existing active subscriptions
  await db.query(`
    UPDATE user_subscriptions
    SET is_active = false
    WHERE user_id = $1 AND is_active = true
  `, [user_id]);
  
  // Then create the new subscription
  const query = `
    INSERT INTO user_subscriptions (user_id, tier, amount, currency)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  
  const result = await db.query(query, [user_id, tier, amount, currency]);
  return result.rows[0];
};

export const cancelUserSubscription = async (userId: number) => {
  const query = `
    UPDATE user_subscriptions
    SET is_active = false, end_date = CURRENT_TIMESTAMP
    WHERE user_id = $1 AND is_active = true
    RETURNING *
  `;
  
  const result = await db.query(query, [userId]);
  return result.rows[0];
}; 