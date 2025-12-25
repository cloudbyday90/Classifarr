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