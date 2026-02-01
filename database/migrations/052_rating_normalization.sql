/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

-- Migration 052: Rating Normalization Support
-- Adds support for preserving original ratings and normalizing to MPAA/TV standards

-- Add original_rating column to preserve the rating before normalization
ALTER TABLE media_server_items 
ADD COLUMN IF NOT EXISTS original_rating VARCHAR(10);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_media_items_original_rating 
ON media_server_items(original_rating);

-- Index for finding items needing normalization
CREATE INDEX IF NOT EXISTS idx_media_items_content_rating 
ON media_server_items(content_rating) 
WHERE original_rating IS NULL;

-- Add comment explaining the column purpose
COMMENT ON COLUMN media_server_items.original_rating IS 
  'Original rating from Plex/Emby before normalization to MPAA standards';
