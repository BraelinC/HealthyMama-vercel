-- Add subscription and trial fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS account_type VARCHAR(50) DEFAULT 'free_trial',
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- Create index for quick lookup of trial status
CREATE INDEX IF NOT EXISTS idx_users_trial_ends_at ON users(trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);