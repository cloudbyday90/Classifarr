-- Migration: Fix Discord enabled flag for existing configurations
-- Bug #11: Discord enabled defaults to false
-- 
-- Problem: Users who configured Discord before the enabled flag existed,
-- or whose configs were created without explicitly setting enabled = true,
-- have notifications silently disabled.
--
-- Solution: Enable Discord for configs that have valid credentials but enabled = false

-- Update notification_config to enable Discord for existing valid configurations
UPDATE notification_config 
SET enabled = true, updated_at = NOW()
WHERE bot_token IS NOT NULL 
  AND bot_token != ''
  AND channel_id IS NOT NULL 
  AND channel_id != ''
  AND enabled = false;

-- Log the migration
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Migration 063: Updated % Discord configurations to enabled = true', updated_count;
END $$;
