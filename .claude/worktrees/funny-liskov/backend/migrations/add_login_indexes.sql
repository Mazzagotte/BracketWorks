-- Performance optimization indexes for login
-- Add composite index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_users_username_login ON users(username) WHERE username IS NOT NULL;

-- Add index for email lookups (used in password reset)
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email) WHERE email IS NOT NULL;

-- Analyze tables for better query planning
ANALYZE users;