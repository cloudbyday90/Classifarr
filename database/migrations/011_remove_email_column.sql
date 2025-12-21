-- Migration 011: Remove email column from users table
-- Email field is no longer used - username is the only identifier
-- Users can use their email AS their username if they prefer

-- Drop the email index if it exists
DROP INDEX IF EXISTS idx_users_email;

-- Remove the email column
ALTER TABLE users DROP COLUMN IF EXISTS email;