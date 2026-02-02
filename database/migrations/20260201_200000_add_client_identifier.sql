-- Migration: Add client_identifier to media_server
-- Created: 2026-02-01
-- Purpose: Fix Plex duplicate library bug by using stable clientIdentifier instead of URL

-- 1. Add column if not exists
ALTER TABLE media_server
ADD COLUMN IF NOT EXISTS client_identifier VARCHAR(255);

-- 2. Drop old constraint (type, url)
ALTER TABLE media_server
DROP CONSTRAINT IF EXISTS media_server_type_url_unique;

-- 3. Add new unique constraint (type, client_identifier)
-- Only for servers that HAVE a client_identifier (Plex). Others might rely on URL still?
-- Actually, Emby/Jellyfin also have IDs, but let's make it partial index or just strict on type/id.
-- Currently only Plex uses this flow. Let's make it unique on (type, client_identifier) OR (type, url) where client_identifier is null?
-- Simpler: Just constraint on client_identifier if present.

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_server_client_identifier ON media_server (client_identifier)
WHERE
    client_identifier IS NOT NULL;

-- 4. Re-add constraint on (type, url) but ONLY where client_identifier IS NULL
-- This supports generic servers or legacy manual entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_server_type_url_legacy
ON media_server (type, url)
WHERE client_identifier IS NULL;