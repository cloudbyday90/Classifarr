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

-- Migration: Add event_sub_type column for more specific event detection
-- This allows libraries to target specific event types (e.g., "christmas" instead of just "holiday")

-- Add event_sub_type column to libraries table
ALTER TABLE libraries
ADD COLUMN IF NOT EXISTS event_sub_type VARCHAR(50) DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN libraries.event_sub_type IS 'Sub-type for event detection (e.g., christmas, halloween for holiday type)';