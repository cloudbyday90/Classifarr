-- Migration 011: Make email optional in users table
-- This allows users to create accounts without providing an email

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;