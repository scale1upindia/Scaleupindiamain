-- Scale-up India — Google OAuth & Identity Federation Migration
-- Migration: 017_google_oauth.sql

-- 1. Modify users table to allow OAuth-only users without password
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- 2. Add Google OAuth and identity fields to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'LOCAL';

-- 3. Create oauth_accounts table for federated identity mapping
CREATE TABLE IF NOT EXISTS oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'google'
    provider_account_id VARCHAR(255) NOT NULL, -- Google subject ID ('sub')
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_oauth_provider_account UNIQUE (provider, provider_account_id)
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider_lookup ON oauth_accounts(provider, provider_account_id);
