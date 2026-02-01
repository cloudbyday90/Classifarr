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

-- v0.36.0: Pattern-Based Classification Configuration
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration adds configuration columns for pattern-based classification
-- including opt-in toggle, priority settings, and cost controls
-- ═══════════════════════════════════════════════════════════════════════════

-- Pattern mining enabled toggle (opt-in, disabled by default)
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS pattern_mining_enabled BOOLEAN DEFAULT false;

-- Pattern vs rule priority: 'rules_first' or 'patterns_first'
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS pattern_rule_priority VARCHAR(20) DEFAULT 'rules_first';

-- AI skip threshold when pattern confidence is high (default 90%)
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS pattern_ai_skip_threshold INTEGER DEFAULT 90;

-- Pattern notification banner dismissed flag
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS pattern_notification_dismissed BOOLEAN DEFAULT false;

-- Add was_correct column to pattern_match_log for accuracy tracking
ALTER TABLE pattern_match_log
ADD COLUMN IF NOT EXISTS was_correct BOOLEAN;

-- Log the migration
COMMENT ON COLUMN ai_provider_config.pattern_mining_enabled IS 'Enable pattern-based classification (opt-in, default false)';
COMMENT ON COLUMN ai_provider_config.pattern_rule_priority IS 'Priority between patterns and rules: rules_first or patterns_first';
COMMENT ON COLUMN ai_provider_config.pattern_ai_skip_threshold IS 'Skip AI when pattern confidence >= this threshold (0-100)';
COMMENT ON COLUMN ai_provider_config.pattern_notification_dismissed IS 'User has dismissed the pattern feature notification banner';
COMMENT ON COLUMN pattern_match_log.was_correct IS 'Whether the pattern prediction was correct (true/false) for reinforcement learning';
