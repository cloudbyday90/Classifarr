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

-- v0.33.0: Add collection_id to classification_history for franchise tracking

-- Add collection_id column for TMDb franchise/collection tracking
ALTER TABLE classification_history
ADD COLUMN IF NOT EXISTS collection_id INTEGER;

-- Add library_name column for easier querying (denormalized)
ALTER TABLE classification_history
ADD COLUMN IF NOT EXISTS library_name VARCHAR(255);

-- Add signals_json column to store all collected signals
ALTER TABLE classification_history
ADD COLUMN IF NOT EXISTS signals_json JSONB;

-- Create index on collection_id for franchise queries
CREATE INDEX IF NOT EXISTS idx_classification_history_collection_id ON classification_history (collection_id)
WHERE
    collection_id IS NOT NULL;