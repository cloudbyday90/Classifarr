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

-- v0.37.0: Add tracking fields to policy_tuning_suggestions
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration adds fields to track when suggestions are applied and their
-- impact on policy accuracy.
-- 
-- Related Issue: #112
-- ═══════════════════════════════════════════════════════════════════════════

-- Add tracking fields for applied suggestions
ALTER TABLE policy_tuning_suggestions
ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS applied_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS before_accuracy REAL;

-- Add index for applied_at for filtering applied suggestions
CREATE INDEX IF NOT EXISTS idx_tuning_suggestions_applied_at ON policy_tuning_suggestions(applied_at);

COMMENT ON COLUMN policy_tuning_suggestions.applied_at IS 'Timestamp when suggestion was applied';
COMMENT ON COLUMN policy_tuning_suggestions.applied_by IS 'User who applied the suggestion';
COMMENT ON COLUMN policy_tuning_suggestions.before_accuracy IS 'Policy accuracy before applying suggestion (for impact tracking)';
