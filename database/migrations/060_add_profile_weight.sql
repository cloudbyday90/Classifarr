-- Migration: 060_add_profile_weight.sql
-- Purpose: Add profile_weight column to library_policies table
-- Date: 2026-01-15
-- Related: PolicyEngine uses profile_weight but column was missing from schema

-- Add profile_weight column to library_policies
-- This weight controls how much the library statistical profile influences classification decisions
-- Default 0.25 (25%) matches the PolicyEngine default
-- Using NOT NULL DEFAULT ensures new and existing rows automatically get the default value
ALTER TABLE library_policies 
ADD COLUMN IF NOT EXISTS profile_weight REAL NOT NULL DEFAULT 0.25;
