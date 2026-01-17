-- Migration: 067_add_api_keys.sql
-- Purpose: Add API key management support for v0.40.0-alpha
-- Related to: API key authentication system

-- Create api_keys table if it doesn't exist
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL DEFAULT 'API Key',
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(8) NOT NULL,
  permissions VARCHAR(50) NOT NULL DEFAULT 'read_write',
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  last_used_ip INET,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP
);

-- Create indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);

-- Add comments to document the table and columns
COMMENT ON TABLE api_keys IS 
  'API key management for external integrations and automation';
COMMENT ON COLUMN api_keys.name IS 
  'User-friendly name for the API key';
COMMENT ON COLUMN api_keys.key_hash IS 
  'Hashed version of the API key for secure storage';
COMMENT ON COLUMN api_keys.key_prefix IS 
  'First 8 characters of the API key for identification (exactly 8 chars)';
COMMENT ON COLUMN api_keys.permissions IS 
  'Permission level: read_only, read_write, or admin';
COMMENT ON COLUMN api_keys.last_used_at IS 
  'Timestamp when the key was last used for authentication';
COMMENT ON COLUMN api_keys.last_used_ip IS 
  'IP address from which the key was last used';
COMMENT ON COLUMN api_keys.is_active IS 
  'Whether the key is currently active and can be used';
COMMENT ON COLUMN api_keys.expires_at IS 
  'Optional expiration timestamp for the key';
