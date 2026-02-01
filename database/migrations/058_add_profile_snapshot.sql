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

/*
 * Migration: Add profile_snapshot column to classification_history
 * Version: 058
 * Description: Store library profile statistics snapshot at classification time
 * For Issue #142 (Epic #136 - v0.39.0-alpha)
 */

-- Add profile_snapshot column to classification_history table
ALTER TABLE classification_history
  ADD COLUMN IF NOT EXISTS profile_snapshot JSONB;

-- Add index for faster queries on profile snapshots
CREATE INDEX IF NOT EXISTS idx_classification_history_profile_snapshot 
  ON classification_history USING gin (profile_snapshot);

-- Add comment to document the column
COMMENT ON COLUMN classification_history.profile_snapshot IS 
  'Library profile statistics snapshot at classification time, used for AI prompt context';
