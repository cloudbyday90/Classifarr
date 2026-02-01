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

-- Migration 021: Add Dismissed Patterns Table
-- Tracks individually dismissed pattern suggestions per library

-- Track dismissed individual patterns
CREATE TABLE IF NOT EXISTS dismissed_patterns (
    id SERIAL PRIMARY KEY,
    library_id INTEGER REFERENCES libraries (id) ON DELETE CASCADE,
    pattern_type VARCHAR(50) NOT NULL, -- 'rating', 'genre', 'collection', 'studio', 'year', 'label'
    pattern_value VARCHAR(255) NOT NULL, -- The specific value like 'PG-13', 'Animation', etc.
    dismissed_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (
        library_id,
        pattern_type,
        pattern_value
    )
);

-- Index for quick lookups when filtering Available Library Filters
CREATE INDEX IF NOT EXISTS idx_dismissed_patterns_library ON dismissed_patterns (library_id);

-- Add pattern_sync_frequency to settings
INSERT INTO
    settings (key, value)
VALUES (
        'pattern_sync_frequency',
        'daily'
    ) ON CONFLICT (key) DO NOTHING;