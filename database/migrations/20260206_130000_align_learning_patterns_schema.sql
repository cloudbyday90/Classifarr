/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

-- Align learning_patterns schema with current server usage.
-- Adds media_type + metadata + created_by and enforces a stable uniqueness key
-- so `ON CONFLICT (tmdb_id, media_type, pattern_type)` works consistently.

ALTER TABLE learning_patterns
  ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);

-- Ensure deterministic uniqueness before adding the constraint.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tmdb_id, media_type, pattern_type
      ORDER BY updated_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM learning_patterns
)
DELETE FROM learning_patterns lp
USING ranked r
WHERE lp.id = r.id
  AND r.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'learning_patterns_tmdb_media_type_pattern_type_key'
  ) THEN
    ALTER TABLE learning_patterns
      ADD CONSTRAINT learning_patterns_tmdb_media_type_pattern_type_key
      UNIQUE (tmdb_id, media_type, pattern_type);
  END IF;
END $$;
