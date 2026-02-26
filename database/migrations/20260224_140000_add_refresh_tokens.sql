-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- Migration: Add refresh tokens for secure JWT session management
-- Created: 2026-02-24

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP,
  revoked_by_ip INET,
  user_agent TEXT,
  device_info JSONB
);

-- Create indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Add comments
COMMENT ON TABLE refresh_tokens IS 
  'Refresh tokens for secure JWT session management';
COMMENT ON COLUMN refresh_tokens.token_hash IS 
  'Hashed refresh token (plaintext never stored)';
COMMENT ON COLUMN refresh_tokens.expires_at IS 
  'Token expiration timestamp';
COMMENT ON COLUMN refresh_tokens.revoked_at IS 
  'When token was revoked (null if active)';
COMMENT ON COLUMN refresh_tokens.device_info IS 
  'Optional device metadata for user session management';
