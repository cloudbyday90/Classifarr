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

-- Migration 025: Add event_detection_type to libraries
-- Allows explicit assignment of event detection type per library
-- Values: 'holiday', 'sports', 'ppv', 'concert', 'awards', or NULL

ALTER TABLE libraries
ADD COLUMN IF NOT EXISTS event_detection_type VARCHAR(50) DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN libraries.event_detection_type IS 'Event detection type: holiday, sports, ppv, concert, awards';