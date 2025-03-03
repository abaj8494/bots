-- Add query limit columns to the users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS daily_query_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_query_limit INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS last_query_date DATE DEFAULT CURRENT_DATE;

-- Add subscription fields if they don't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE; 