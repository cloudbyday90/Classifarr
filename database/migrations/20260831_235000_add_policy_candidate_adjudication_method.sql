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

-- Migration: 20260831_235000_add_policy_candidate_adjudication_method.sql
-- Purpose: Permit the persisted result method emitted by the bounded
--          policy-candidate adjudication path. Without this value, an
--          otherwise completed classification fails while writing history
--          and is retried indefinitely until its retry budget is exhausted.

ALTER TABLE classification_history
DROP CONSTRAINT IF EXISTS classification_history_method_check;

ALTER TABLE classification_history
ADD CONSTRAINT classification_history_method_check CHECK (
    method IN (
        'existing_media',
        'manual_correction',
        'manual_classification',
        'exact_match',
        'learned_pattern',
        'source_library',
        'policy_auto',
        'policy_prompt',
        'policy_recheck',
        'ai_verified',
        'ai_analysis',
        'ai_rerun',
        'signal_calculation',
        'fallback',
        'queued_for_retry',
        'custom_rule',
        'rule_match',
        'ai_fallback',
        'holiday_detection',
        'library_rule',
        'rag_improved',
        'authoritative_source_library',
        'policy_engine',
        'policy_candidate_adjudication'
    )
);
