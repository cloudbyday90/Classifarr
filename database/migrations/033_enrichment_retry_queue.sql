-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

-- Migration: Enrichment Retry Queue
-- Tracks items that failed OMDb enrichment for Tavily fallback
-- Respects Tavily monthly quota by queuing items for later processing

CREATE TABLE IF NOT EXISTS enrichment_retry_queue (
    id SERIAL PRIMARY KEY,
    media_item_id INTEGER NOT NULL REFERENCES media_server_items (id) ON DELETE CASCADE,
    enrichment_type VARCHAR(20) NOT NULL DEFAULT 'tavily', -- 'tavily', 'tmdb', 'omdb'
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'skipped'
    reason TEXT, -- why it was queued (e.g., 'OMDb not found')
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    priority INTEGER NOT NULL DEFAULT 5, -- 1=highest, 10=lowest
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        last_attempt_at TIMESTAMP
    WITH
        TIME ZONE,
        completed_at TIMESTAMP
    WITH
        TIME ZONE,
        error_message TEXT, -- last error if failed
        UNIQUE (
            media_item_id,
            enrichment_type
        )
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_enrichment_retry_status ON enrichment_retry_queue (status, enrichment_type);

CREATE INDEX IF NOT EXISTS idx_enrichment_retry_priority ON enrichment_retry_queue (priority, created_at)
WHERE
    status = 'pending';

CREATE INDEX IF NOT EXISTS idx_enrichment_retry_media_item ON enrichment_retry_queue (media_item_id);

-- Add enrichment_status column to media_server_items for quick lookup
ALTER TABLE media_server_items
ADD COLUMN IF NOT EXISTS enrichment_status VARCHAR(20) DEFAULT 'pending';

-- Update existing items based on current state
UPDATE media_server_items
SET
    enrichment_status = CASE
        WHEN metadata -> 'omdb' IS NOT NULL THEN 'completed'
        WHEN metadata -> 'content_analysis' IS NOT NULL THEN 'partial'
        ELSE 'pending'
    END;

COMMENT ON
TABLE enrichment_retry_queue IS 'Queue for items that need enrichment retry (e.g., OMDb failed, try Tavily)';