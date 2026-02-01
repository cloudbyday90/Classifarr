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

-- Migration: Allow NULL tmdb_id in classification_history
-- This enables logging library items that don't have TMDB matches
-- (e.g., personal videos, obscure content, or items only matched via TVDB)

ALTER TABLE classification_history
ALTER COLUMN tmdb_id
DROP NOT NULL;

-- Add index for efficient querying of items without TMDB
CREATE INDEX IF NOT EXISTS idx_classification_history_null_tmdb ON classification_history (library_id)
WHERE
    tmdb_id IS NULL;