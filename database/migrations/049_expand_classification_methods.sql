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

-- Migration: 049_expand_classification_methods.sql
-- Purpose: Add current classification methods and maintain legacy ones for historical data

-- Drop the old constraint
ALTER TABLE classification_history
DROP CONSTRAINT IF EXISTS classification_history_method_check;

-- Add new constraint with all methods (current + legacy for historical data)
ALTER TABLE classification_history 
ADD CONSTRAINT classification_history_method_check 
CHECK (method IN (
    -- CURRENT METHODS (v0.37.8c+)
    'existing_media',       -- Media already in library
    'manual_correction',    -- User correction from learned_corrections
    'exact_match',          -- Previously confirmed TMDB ID
    'learned_pattern',      -- Pattern-based matching (still active)
    'source_library',       -- Came from known media server library
    'policy_auto',          -- PolicyEngine auto-classification (>=85%)
    'policy_prompt',        -- PolicyEngine prompts for confirmation (60-84%)
    'ai_verified',          -- AI validation path
    'ai_analysis',          -- AI analysis for low-confidence
    'signal_calculation',   -- Fallback when AI unavailable
    'fallback',             -- Last resort fallback

-- LEGACY METHODS (kept for historical data, no longer set)
'custom_rule',          -- Deprecated: replaced by PolicyEngine
    'rule_match',           -- Deprecated: replaced by PolicyEngine
    'ai_fallback',          -- Deprecated: replaced by ai_analysis
    'holiday_detection',    -- Deprecated: replaced by seasonal presets
    'library_rule'          -- Deprecated: replaced by PolicyEngine
));