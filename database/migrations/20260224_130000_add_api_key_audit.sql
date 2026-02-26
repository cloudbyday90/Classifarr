-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- Migration: Add API key local audit logging
-- Created: 2026-02-24
-- Purpose: Enables local-only security audit trail for API key usage.
--   NO external telemetry - data stays in your database for your review.
--   Useful for: detecting unauthorized access, reviewing key usage patterns.

-- Create api_key_audit table for LOCAL security audit logging (not telemetry)
CREATE TABLE IF NOT EXISTS api_key_audit (
  id SERIAL PRIMARY KEY,
  api_key_id INTEGER REFERENCES api_keys(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_api_key_audit_key_id ON api_key_audit(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_audit_action ON api_key_audit(action);
CREATE INDEX IF NOT EXISTS idx_api_key_audit_created_at ON api_key_audit(created_at);

-- Update comment on permissions column to reflect new types
COMMENT ON COLUMN api_keys.permissions IS 
  'Permission level: read_only, read_write, webhook_only, or admin';
