-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Migration: add read only music source library discovery
-- Created: 2026-09-24T14:16:09.841Z
-- ═══════════════════════════════════════════════════════════════════════════

-- This table is intentionally outside libraries and media_server_items. A
-- discovered music section can never acquire a policy, ARR mapping, or RAG
-- work through a foreign key to the routing inventory.
CREATE TABLE IF NOT EXISTS media_source_discovery_libraries (
    id BIGSERIAL PRIMARY KEY,
    media_server_id INTEGER NOT NULL REFERENCES media_server(id) ON DELETE CASCADE,
    external_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    media_type VARCHAR(20) NOT NULL CHECK (media_type = 'music'),
    is_present BOOLEAN NOT NULL DEFAULT TRUE,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (media_server_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_media_source_discovery_libraries_server
    ON media_source_discovery_libraries (media_server_id, is_present, name);

COMMENT ON TABLE media_source_discovery_libraries IS
    'Source library sections observed in read-only discovery; never classification destinations.';
