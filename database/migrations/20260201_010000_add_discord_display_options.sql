-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Migration: Add Discord Display Options Settings
-- Created: 2026-02-01
-- Related: PR #254 (Remove duplicate confidence threshold sliders)
-- ═══════════════════════════════════════════════════════════════════════════

-- Add Discord display option settings
INSERT INTO confidence_settings (setting_key, setting_value, description, default_value)
VALUES
  (
    'discord_include_signal_breakdown',
    'true',
    'Always include AI signal breakdown in Discord verification messages',
    'true'
  ),
  (
    'discord_show_similar_items',
    'true',
    'Show top 3 similar items already in library in Discord messages',
    'true'
  )
ON CONFLICT (setting_key) DO UPDATE SET
  description = EXCLUDED.description,
  default_value = EXCLUDED.default_value;

-- Add comment explaining these settings
COMMENT ON TABLE confidence_settings IS 
  'Configuration settings for confidence thresholds and behavior. 
   Policy thresholds control both classification AND Discord notification behavior.
   Discord display settings control what information is shown in notification messages.';
