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

-- Migration: 021_learned_corrections.sql
-- Description: Create learned_corrections table for storing user corrections as truth
-- Version: 0.30.0

-- Learned corrections (user truth table)
-- When a user corrects a classification, store it here so future items with same TMDB ID
-- are automatically routed correctly (priority above AI and rules)
CREATE TABLE IF NOT EXISTS learned_corrections (
    id SERIAL PRIMARY KEY,
    tmdb_id INTEGER NOT NULL,
    media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('movie', 'tv')),
    original_library_id INTEGER REFERENCES libraries(id) ON DELETE SET NULL,
    corrected_library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    title VARCHAR(512),  -- For reference/display
    year INTEGER,  -- For reference
    user_note TEXT,  -- Optional user explanation
    corrected_by VARCHAR(255),  -- Discord username or 'platform'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

-- One truth per TMDB ID + media type combination
UNIQUE(tmdb_id, media_type) );

-- Index for quick classification lookups
CREATE INDEX IF NOT EXISTS idx_learned_corrections_lookup ON learned_corrections (tmdb_id, media_type);