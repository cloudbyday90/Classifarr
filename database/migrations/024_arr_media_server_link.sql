-- Migration: 022_arr_media_server_link.sql
-- Description: Link *arr instances to media servers for strict relationship enforcement
-- Version: 0.30.0

-- Add media_server_id to radarr_config
-- Each Radarr instance belongs to exactly ONE media server
ALTER TABLE radarr_config
ADD COLUMN IF NOT EXISTS media_server_id INTEGER REFERENCES media_server (id) ON DELETE SET NULL;

-- Add media_server_id to sonarr_config
-- Each Sonarr instance belongs to exactly ONE media server
ALTER TABLE sonarr_config
ADD COLUMN IF NOT EXISTS media_server_id INTEGER REFERENCES media_server (id) ON DELETE SET NULL;

-- Create app_settings table for migration tracking and app configuration
CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial settings
INSERT INTO
    app_settings (key, value)
VALUES ('classifarr_media_path', NULL),
    (
        'library_mapping_complete',
        'false'
    ),
    (
        'reclassification_enabled',
        'false'
    ) ON CONFLICT (key) DO NOTHING;