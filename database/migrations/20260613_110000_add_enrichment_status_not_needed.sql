-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Migration: Add 'not_needed' status to enrichment_status
-- Purpose: Allow items to be marked as 'not_needed' when they have been enriched without OMDb because OMDb is inactive.

ALTER TABLE media_server_items DROP CONSTRAINT IF EXISTS media_server_items_enrichment_status_check;

ALTER TABLE media_server_items
ADD CONSTRAINT media_server_items_enrichment_status_check
CHECK (enrichment_status IN ('pending', 'processing', 'completed', 'deferred', 'failed', 'not_needed'));

COMMENT ON COLUMN media_server_items.enrichment_status IS 'Explicit enrichment workflow state for the item (pending, processing, completed, deferred, failed, not_needed).';
