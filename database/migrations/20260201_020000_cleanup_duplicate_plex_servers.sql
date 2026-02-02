-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Migration: Clean up duplicate Plex servers and libraries
-- Created: 2026-02-01
-- Related: Issue #257 (Plex OAuth duplicate libraries bug)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    active_server_id INTEGER;
    duplicate_count INTEGER;
    library_count INTEGER;
BEGIN
    -- Find the active Plex server (or most recent one if multiple active)
    SELECT id INTO active_server_id
    FROM media_server
    WHERE type = 'plex' AND is_active = true
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    -- If no active server, find the most recent Plex server
    IF active_server_id IS NULL THEN
        SELECT id INTO active_server_id
        FROM media_server
        WHERE type = 'plex'
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1;
    END IF;

    -- Only proceed if we found a Plex server
    IF active_server_id IS NOT NULL THEN
        -- Count duplicates before cleanup
        SELECT COUNT(*) INTO duplicate_count
        FROM media_server
        WHERE type = 'plex' AND id != active_server_id;

        SELECT COUNT(*) INTO library_count
        FROM libraries
        WHERE media_server_id IN (
            SELECT id FROM media_server
            WHERE type = 'plex' AND id != active_server_id
        );

        -- Log what we're doing
        RAISE NOTICE 'Cleanup: Keeping Plex server ID %, removing % duplicate server(s) and % orphaned libraries',
            active_server_id, duplicate_count, library_count;

        -- Update radarr_config and sonarr_config to point to active_server_id
        -- if they currently point to a duplicate Plex server that will be deleted
        UPDATE radarr_config
        SET media_server_id = active_server_id
        WHERE media_server_id IN (
            SELECT id FROM media_server
            WHERE type = 'plex' AND id != active_server_id
        );

        UPDATE sonarr_config
        SET media_server_id = active_server_id
        WHERE media_server_id IN (
            SELECT id FROM media_server
            WHERE type = 'plex' AND id != active_server_id
        );

        -- Delete libraries belonging to duplicate/inactive servers
        -- This will cascade to related tables
        DELETE FROM libraries
        WHERE media_server_id IN (
            SELECT id FROM media_server 
            WHERE type = 'plex' AND id != active_server_id
        );

        -- Delete duplicate/inactive Plex servers
        DELETE FROM media_server
        WHERE type = 'plex' AND id != active_server_id;

        -- Ensure the kept server is marked as active
        UPDATE media_server
        SET is_active = true
        WHERE id = active_server_id;

        RAISE NOTICE 'Cleanup complete: Removed % duplicate servers and % orphaned libraries',
            duplicate_count, library_count;
    ELSE
        RAISE NOTICE 'No Plex servers found - skipping cleanup';
    END IF;
END $$;
