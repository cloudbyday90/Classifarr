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

-- Migration: Add clarification_response column to classification_history
-- Stores user responses to AI clarification questions for learning

-- Add clarification_response column
ALTER TABLE classification_history
ADD COLUMN IF NOT EXISTS clarification_response JSONB;

-- Add index for querying clarified items
CREATE INDEX IF NOT EXISTS idx_classification_history_clarified ON classification_history (clarification_status)
WHERE
    clarification_status IS NOT NULL;