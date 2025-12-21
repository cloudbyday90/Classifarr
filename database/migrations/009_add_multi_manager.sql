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