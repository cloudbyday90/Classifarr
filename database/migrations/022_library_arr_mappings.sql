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

-- Migration: 020_library_arr_mappings.sql
-- Description: Create library_arr_mappings table for Plex library to *arr root folder mapping
-- Version: 0.30.0

-- Library to *arr root folder mapping
-- Each Plex library maps to exactly ONE root folder in ONE *arr instance
CREATE TABLE IF NOT EXISTS library_arr_mappings (
    id SERIAL PRIMARY KEY,
    library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    arr_type VARCHAR(10) NOT NULL CHECK (arr_type IN ('radarr', 'sonarr')),
    arr_config_id INTEGER NOT NULL,  -- FK to radarr_config or sonarr_config (polymorphic)
    arr_root_folder_id INTEGER NOT NULL,  -- ID from *arr API
    arr_root_folder_path VARCHAR(512) NOT NULL,  -- Path as seen by *arr
    quality_profile_id INTEGER,  -- Default quality profile for this mapping

-- Path translation for different Docker/system views
plex_path_prefix VARCHAR(512), -- Path as seen by Plex (e.g., /mnt/user/media/movies)
arr_path_prefix VARCHAR(512), -- Path as seen by *arr (e.g., /movies)
classifarr_path_prefix VARCHAR(512), -- Path as seen by Classifarr (e.g., /data/movies)
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

-- Each library can only have one mapping
UNIQUE(library_id) );

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_library_arr_mappings_library ON library_arr_mappings (library_id);

CREATE INDEX IF NOT EXISTS idx_library_arr_mappings_arr ON library_arr_mappings (arr_type, arr_config_id);