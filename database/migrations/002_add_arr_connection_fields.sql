-- Migration: Add granular connection fields to radarr_config and sonarr_config
-- Date: 2025-12-18
-- Description: Adds protocol, host, port, base_path, verify_ssl, and timeout fields

-- Add fields to radarr_config table
ALTER TABLE radarr_config 
ADD COLUMN IF NOT EXISTS protocol VARCHAR(10) DEFAULT 'http',
ADD COLUMN IF NOT EXISTS host VARCHAR(255) DEFAULT 'localhost',
ADD COLUMN IF NOT EXISTS port INTEGER DEFAULT 7878,
ADD COLUMN IF NOT EXISTS base_path VARCHAR(100) DEFAULT '',
ADD COLUMN IF NOT EXISTS verify_ssl BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS timeout INTEGER DEFAULT 30;

-- Add fields to sonarr_config table
ALTER TABLE sonarr_config 
ADD COLUMN IF NOT EXISTS protocol VARCHAR(10) DEFAULT 'http',
ADD COLUMN IF NOT EXISTS host VARCHAR(255) DEFAULT 'localhost',
ADD COLUMN IF NOT EXISTS port INTEGER DEFAULT 8989,
ADD COLUMN IF NOT EXISTS base_path VARCHAR(100) DEFAULT '',
ADD COLUMN IF NOT EXISTS verify_ssl BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS timeout INTEGER DEFAULT 30;

-- Update existing records to populate new fields from existing url
-- This assumes urls are in format "protocol://host:port/path"
UPDATE radarr_config 
SET 
  protocol = CASE 
    WHEN url LIKE 'https://%' THEN 'https'
    ELSE 'http'
  END,
  host = REGEXP_REPLACE(
    REGEXP_REPLACE(url, '^https?://', ''),
    ':[0-9]+.*$', ''
  ),
  port = COALESCE(
    NULLIF(
      REGEXP_REPLACE(
        REGEXP_REPLACE(url, '^https?://[^:]+:', ''),
        '/.*$', ''
      ),
      ''
    )::INTEGER,
    7878
  ),
  base_path = COALESCE(
    NULLIF(
      REGEXP_REPLACE(
        REGEXP_REPLACE(url, '^https?://[^/]+', ''),
        '^/$', ''
      ),
      ''
    ),
    ''
  )
WHERE protocol IS NULL OR host IS NULL;

UPDATE sonarr_config 
SET 
  protocol = CASE 
    WHEN url LIKE 'https://%' THEN 'https'
    ELSE 'http'
  END,
  host = REGEXP_REPLACE(
    REGEXP_REPLACE(url, '^https?://', ''),
    ':[0-9]+.*$', ''
  ),
  port = COALESCE(
    NULLIF(
      REGEXP_REPLACE(
        REGEXP_REPLACE(url, '^https?://[^:]+:', ''),
        '/.*$', ''
      ),
      ''
    )::INTEGER,
    8989
  ),
  base_path = COALESCE(
    NULLIF(
      REGEXP_REPLACE(
        REGEXP_REPLACE(url, '^https?://[^/]+', ''),
        '^/$', ''
      ),
      ''
    ),
    ''
  )
WHERE protocol IS NULL OR host IS NULL;
