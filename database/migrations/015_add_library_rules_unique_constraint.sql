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

-- Migration: Add unique constraint to library_rules to prevent duplicate rules
-- This ensures ON CONFLICT DO NOTHING works correctly

-- First, remove any existing duplicates (keep the one with lowest id)
DELETE FROM library_rules
WHERE
    id NOT IN(
        SELECT MIN(id)
        FROM library_rules
        GROUP BY
            library_id,
            rule_type,
            operator,
            value
    );

-- Add unique constraint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'library_rules_unique_rule') THEN
        ALTER TABLE library_rules
        ADD CONSTRAINT library_rules_unique_rule UNIQUE (
            library_id,
            rule_type,
            operator,
            value
        );
    END IF;
END $$;