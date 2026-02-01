/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Migration: 048_library_profiles.sql
 * Purpose: Replace Pattern Management with auto-generated Library Profiles
 * 
 * Library Profiles store statistical distributions of content in each library.
 * These are used by the PolicyEngine to score incoming items against what
 * already exists in each library.
 */

-- ===========================================
-- NEW TABLE: library_profiles
-- ===========================================

CREATE TABLE IF NOT EXISTS library_profiles (
    id SERIAL PRIMARY KEY,
    library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE,

-- Profile statistics (JSONB for flexibility)
-- Values are percentages: {"PG": 83, "G": 15} means 83% PG, 15% G
rating_distribution JSONB DEFAULT '{}',
genre_distribution JSONB DEFAULT '{}',
studio_distribution JSONB DEFAULT '{}',
keyword_distribution JSONB DEFAULT '{}',

-- Computed exclusions (0% = never appears in library)
-- Used for negative scoring when item has these attributes
exclusion_ratings TEXT[] DEFAULT '{}',
    exclusion_genres TEXT[] DEFAULT '{}',
    exclusion_keywords TEXT[] DEFAULT '{}',

-- Counts for tracking
item_count INTEGER DEFAULT 0, enriched_count INTEGER DEFAULT 0,

-- Timestamps
last_generated_at TIMESTAMP,
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW(),

-- Each library has exactly one profile
UNIQUE(library_id) );

-- Index for fast lookup by library
CREATE INDEX IF NOT EXISTS idx_library_profiles_library ON library_profiles (library_id);

-- ===========================================
-- SETTINGS: Profile configuration
-- ===========================================

INSERT INTO
    settings (key, value)
VALUES ('profile_batch_size', '100'),
    (
        'profile_auto_generate',
        'true'
    ) ON CONFLICT (key) DO NOTHING;

-- ===========================================
-- DEPRECATE: Pattern tables (keep data, stop using)
-- ===========================================

-- Add deprecated_at column to mark pattern tables as legacy
ALTER TABLE discovered_patterns
ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMP;

-- Mark all existing patterns as deprecated
UPDATE discovered_patterns
SET
    deprecated_at = NOW()
WHERE
    deprecated_at IS NULL;

-- Add comment explaining deprecation
COMMENT ON
TABLE discovered_patterns IS 'DEPRECATED in v0.38.0 - Replaced by library_profiles. Data kept for historical reference.';

-- ===========================================
-- VERIFICATION
-- ===========================================

-- Quick verification that table was created
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'library_profiles') THEN
        RAISE NOTICE 'library_profiles table created successfully';
    ELSE
        RAISE EXCEPTION 'library_profiles table was not created';
    END IF;
END $$;