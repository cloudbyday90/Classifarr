-- Migration: Allow NULL tmdb_id in classification_history
-- This enables logging library items that don't have TMDB matches
-- (e.g., personal videos, obscure content, or items only matched via TVDB)

ALTER TABLE classification_history
ALTER COLUMN tmdb_id
DROP NOT NULL;

-- Add index for efficient querying of items without TMDB
CREATE INDEX IF NOT EXISTS idx_classification_history_null_tmdb ON classification_history (library_id)
WHERE
    tmdb_id IS NULL;