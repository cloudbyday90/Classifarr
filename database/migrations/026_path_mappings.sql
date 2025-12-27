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