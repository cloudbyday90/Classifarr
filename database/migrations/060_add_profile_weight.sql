-- Migration: 060_add_profile_weight.sql
-- Purpose: Add profile_weight column to library_policies table
-- Date: 2026-01-15
-- Related: PolicyEngine uses profile_weight but column was missing from schema

-- Add profile_weight column to library_policies
-- This weight controls how much the library statistical profile influences classification decisions
-- Default 0.25 (25%) matches the PolicyEngine default
ALTER TABLE library_policies 
ADD COLUMN IF NOT EXISTS profile_weight REAL;

-- Update existing policies to use the default weight (0.25)
-- This ensures backward compatibility with existing policies
UPDATE library_policies
SET profile_weight = 0.25
WHERE profile_weight IS NULL;
