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

-- Migration 076: Remove Duplicate Discord Threshold Settings
-- ═══════════════════════════════════════════════════════════════════════════
-- Description: Remove redundant Discord-specific threshold settings that were
--              never actually used. Discord uses the tier-based system from the
--              confidence_thresholds table instead.
-- Issue: Remove duplicate confidence threshold sliders

-- Remove duplicate Discord threshold settings
-- These settings were never used by Discord (it uses confidence_thresholds table)
DELETE FROM confidence_settings 
WHERE setting_key IN (
  'discord_auto_route_threshold',
  'discord_verify_threshold',
  'discord_enhanced_details_threshold'
);

-- Add comment to confidence_settings table
COMMENT ON TABLE confidence_settings IS 
'Configuration settings for confidence thresholds and behavior. Discord uses the separate confidence_thresholds table for its tier-based notification system.';
