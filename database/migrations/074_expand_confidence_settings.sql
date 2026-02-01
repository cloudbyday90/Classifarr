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

-- Migration 074: Expand Confidence Settings for Unified Settings Page
-- ═══════════════════════════════════════════════════════════════════════════
-- Description: Expands confidence_settings table and adds audit trail for #241
-- Issue: #241 - Create unified settings page for all confidence thresholds

-- Expand confidence_settings table to include description and defaults
ALTER TABLE confidence_settings
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS default_value TEXT,
ADD COLUMN IF NOT EXISTS validation_schema JSONB;

-- Create audit trail table
CREATE TABLE IF NOT EXISTS confidence_settings_audit (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW(),
  change_reason TEXT,
  ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_confidence_audit_key ON confidence_settings_audit(setting_key);
CREATE INDEX IF NOT EXISTS idx_confidence_audit_date ON confidence_settings_audit(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_confidence_audit_user ON confidence_settings_audit(changed_by);

-- Insert new confidence threshold settings for policy, discord, and learning
INSERT INTO confidence_settings (setting_key, setting_value, description, default_value) VALUES
('policy_auto_classify_threshold', '85', 'Confidence % for auto-classification', '85'),
('policy_prompt_threshold', '60', 'Confidence % for user confirmation prompt', '60'),
('discord_auto_route_threshold', '85', 'Discord info-only message threshold', '85'),
('discord_verify_threshold', '60', 'Discord Yes/No verification threshold', '60'),
('discord_enhanced_details_threshold', '60', 'Discord detailed breakdown threshold', '60'),
('learning_genre_threshold', '3', 'Confirmations needed to learn genre preference', '3'),
('learning_keyword_threshold', '5', 'Confirmations needed to learn keyword preference', '5'),
('learning_studio_threshold', '2', 'Confirmations needed to learn studio preference', '2'),
('learning_min_confidence_rate', '75', 'Minimum % of confirms vs rejects', '75'),
('learning_conflict_strategy', 'escalate', 'Conflict resolution: block, escalate, auto_resolve', 'escalate'),
('learning_auto_resolve_threshold', '7', 'Confirmations to override exclusion', '7'),
('learning_multi_genre_strategy', 'weighted', 'Multi-genre learning: primary_only, weighted, all', 'weighted'),
('learning_max_per_user_day', '50', 'Max auto-learns per user per day', '50'),
('learning_max_per_library_hour', '20', 'Max auto-learns per library per hour', '20'),
('learning_lookback_days', '30', 'Days of feedback to consider', '30')
ON CONFLICT (setting_key) DO UPDATE SET
  description = EXCLUDED.description,
  default_value = EXCLUDED.default_value;

-- Update existing settings with descriptions
UPDATE confidence_settings
SET description = 'Source library signal weight', default_value = '100'
WHERE setting_key = 'weight_source_library';

UPDATE confidence_settings
SET description = 'Manual correction signal weight', default_value = '100'
WHERE setting_key = 'weight_manual_correction';

UPDATE confidence_settings
SET description = 'Existing media signal weight', default_value = '100'
WHERE setting_key = 'weight_existing_media';

UPDATE confidence_settings
SET description = 'Exact match signal weight', default_value = '100'
WHERE setting_key = 'weight_exact_match';

UPDATE confidence_settings
SET description = 'Event detection signal weight', default_value = '30'
WHERE setting_key = 'weight_event_detection';

UPDATE confidence_settings
SET description = 'Custom rule signal weight', default_value = '35'
WHERE setting_key = 'weight_custom_rule';

UPDATE confidence_settings
SET description = 'Collection match signal weight', default_value = '25'
WHERE setting_key = 'weight_collection_match';

UPDATE confidence_settings
SET description = 'Learned pattern signal weight', default_value = '20'
WHERE setting_key = 'weight_learned_pattern';

UPDATE confidence_settings
SET description = 'Content analysis signal weight', default_value = '15'
WHERE setting_key = 'weight_content_analysis';

UPDATE confidence_settings
SET description = 'Keyword match signal weight', default_value = '10'
WHERE setting_key = 'weight_keyword_match';

UPDATE confidence_settings
SET description = 'Genre match signal weight', default_value = '10'
WHERE setting_key = 'weight_genre_match';

UPDATE confidence_settings
SET description = 'Global confidence threshold', default_value = '80'
WHERE setting_key = 'confidence_threshold';
