-- Migration: Add include_specials to webhook_config
-- Allows explicitly including season 0 (specials) when requested

ALTER TABLE webhook_config
ADD COLUMN IF NOT EXISTS include_specials BOOLEAN DEFAULT false;
