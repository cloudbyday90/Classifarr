/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

-- Migration: Add *arr settings to libraries
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS radarr_settings JSONB DEFAULT '{}';
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS sonarr_settings JSONB DEFAULT '{}';

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

CREATE INDEX IF NOT EXISTS idx_arr_profiles_cache_type ON arr_profiles_cache(arr_type, profile_type);
