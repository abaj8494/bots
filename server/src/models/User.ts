import db from '../config/db';
import bcrypt from 'bcrypt';

interface User {
  id?: number;
  username: string;
  email: string;
  password: string;
  created_at?: Date;
}

interface UserApiKey {
  id?: number;
  user_id: number;
  api_key: string;
  is_active: boolean;
  created_at?: Date;
}

export const createUser = async (userData: User) => {
  const { username, email, password } = userData;
  
  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  
  const query = `
    INSERT INTO users (username, email, password)
    VALUES ($1, $2, $3)
    RETURNING id, username, email, created_at
  `;
  
  const result = await db.query(query, [username, email, hashedPassword]);
  return result.rows[0];
};

export const getUserByEmail = async (email: string) => {
  const query = 'SELECT * FROM users WHERE email = $1';
  const result = await db.query(query, [email]);
  return result.rows[0];
};

export const getUserById = async (id: number) => {
  const query = 'SELECT id, username, email, created_at FROM users WHERE id = $1';
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