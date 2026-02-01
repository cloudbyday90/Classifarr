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

-- Migration: Add path mappings table for reclassification file operations
-- This allows translating paths between *arr containers and Classifarr container

CREATE TABLE IF NOT EXISTS path_mappings (
    id SERIAL PRIMARY KEY,
    arr_path VARCHAR(1024) NOT NULL, -- Path as seen by Radarr/Sonarr
    local_path VARCHAR(1024) NOT NULL, -- Path as seen by Classifarr container
    is_active BOOLEAN DEFAULT true,
    verified BOOLEAN DEFAULT false, -- Whether the path has been verified accessible
    last_verified_at TIMESTAMP, -- When path was last verified
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_path_mappings_arr_path ON path_mappings (arr_path);

CREATE INDEX IF NOT EXISTS idx_path_mappings_active ON path_mappings (is_active);