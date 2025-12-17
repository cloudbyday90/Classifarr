-- Migration: Add *arr settings to libraries
-- Date: 2024-01-01
-- Description: Add radarr_settings and sonarr_settings JSONB columns to libraries table
--              and create arr_profiles_cache table for caching profiles from Radarr/Sonarr

-- Add new columns to libraries table
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS radarr_settings JSONB DEFAULT '{}';
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS sonarr_settings JSONB DEFAULT '{}';

-- Create arr_profiles_cache table
CREATE TABLE IF NOT EXISTS arr_profiles_cache (
    id SERIAL PRIMARY KEY,
    arr_type VARCHAR(10) NOT NULL CHECK (arr_type IN ('radarr', 'sonarr')),
    profile_type VARCHAR(50) NOT NULL CHECK (profile_type IN ('root_folder', 'quality_profile', 'tag')),
    profile_id INT NOT NULL,
    profile_name VARCHAR(255),
    profile_path VARCHAR(500),
    profile_data JSONB,
    last_synced TIMESTAMP DEFAULT NOW(),
    UNIQUE(arr_type, profile_type, profile_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_arr_profiles_cache_type ON arr_profiles_cache(arr_type, profile_type);

-- Note: Legacy fields (arr_type, arr_id, root_folder, quality_profile_id) are kept for backward compatibility
-- New implementations should use radarr_settings/sonarr_settings JSONB fields
