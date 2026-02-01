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

-- Migration: Add multi-request manager support
-- Allows configuring multiple webhook sources (Overseerr, Jellyseerr, Seer instances)

-- Add name column for identifying each webhook source
ALTER TABLE webhook_config
ADD COLUMN IF NOT EXISTS name VARCHAR(100);

-- Add is_primary flag to identify the default/primary webhook source
ALTER TABLE webhook_config
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Add URL for the request manager (optional, for display purposes)
ALTER TABLE webhook_config
ADD COLUMN IF NOT EXISTS manager_url VARCHAR(500);

-- Update existing row to be primary and have a default name
UPDATE webhook_config
SET
    name = COALESCE(name, 'Default'),
    is_primary = true
WHERE
    id = (
        SELECT MIN(id)
        FROM webhook_config
    );

-- Add webhook_config_id to webhook_log for per-source tracking
ALTER TABLE webhook_log
ADD COLUMN IF NOT EXISTS webhook_config_id INTEGER REFERENCES webhook_config (id) ON DELETE SET NULL;

-- Add index for filtering logs by source
CREATE INDEX IF NOT EXISTS idx_webhook_log_config ON webhook_log (webhook_config_id);