-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Migration: Add unique constraint on media_server (type, url)
-- Created: 2026-02-01
-- Related: Issue #257 (Plex OAuth duplicate libraries bug - race condition fix)
-- ═══════════════════════════════════════════════════════════════════════════

-- Remove any existing duplicates before adding the constraint
-- Keep the most recent server for each (type, url) combination
DO $$
DECLARE
    duplicate_row RECORD;
BEGIN
    -- For each (type, url) group with duplicates, delete all but the most recent
    FOR duplicate_row IN
        SELECT type, url, array_agg(id ORDER BY updated_at DESC NULLS LAST, created_at DESC) AS server_ids
        FROM media_server
        GROUP BY type, url
        HAVING COUNT(*) > 1
    LOOP
        -- Keep the first ID (most recent), delete the rest
        DELETE FROM media_server
        WHERE id = ANY(duplicate_row.server_ids[2:]);
        
        RAISE NOTICE 'Removed % duplicate(s) for type=%, url=%',
            array_length(duplicate_row.server_ids, 1) - 1,
            duplicate_row.type,
            duplicate_row.url;
    END LOOP;
END $$;

-- Add unique constraint to prevent future duplicates
ALTER TABLE media_server
ADD CONSTRAINT media_server_type_url_unique UNIQUE (type, url);
