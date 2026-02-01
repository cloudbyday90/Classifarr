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

-- Migration: 013_unify_library_rules.sql
-- Created: 2025-12-23
-- Purpose: Consolidate library_rules and library_custom_rules into unified table

-- Create new unified table
CREATE TABLE IF NOT EXISTS library_rules_v2 (
    id SERIAL PRIMARY KEY,
    library_id INTEGER NOT NULL REFERENCES libraries (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_library_rules_v2_library_id ON library_rules_v2 (library_id);

CREATE INDEX IF NOT EXISTS idx_library_rules_v2_conditions ON library_rules_v2 USING GIN (conditions);

-- Migrate data from library_rules (simple rules -> single condition)
DO $$
BEGIN
    -- Only run migration if destination table is empty
    IF NOT EXISTS (SELECT 1 FROM library_rules_v2 LIMIT 1) THEN
        -- Migrate data from library_rules (simple rules -> single condition)
        INSERT INTO library_rules_v2 (
            library_id,
            name,
            description,
            conditions,
            is_active,
            priority,
            created_at,
            updated_at
        )
        SELECT
            library_id,
            COALESCE(
                description,
                rule_type || ' ' || operator || ' ' || value
            ) as name,
            description,
            jsonb_build_array (
                jsonb_build_object (
                    'field',
                    rule_type,
                    'operator',
                    operator,
                    'value',
                    value
                )
            ) as conditions,
            COALESCE(is_active, true) as is_active,
            COALESCE(priority, 0) as priority,
            created_at,
            updated_at
        FROM library_rules
        WHERE
            library_id IS NOT NULL;

        -- Migrate data from library_custom_rules (complex rules -> use existing rule_json)
        INSERT INTO library_rules_v2 (
            library_id,
            name,
            description,
            conditions,
            is_active,
            priority,
            created_at,
            updated_at
        )
        SELECT
            library_id,
            name,
            description,
            CASE
                WHEN jsonb_typeof (rule_json) = 'array' THEN rule_json
                ELSE jsonb_build_array (rule_json)
            END as conditions,
            COALESCE(is_active, true) as is_active,
            0 as priority,
            created_at,
            updated_at
        FROM library_custom_rules
        WHERE
            library_id IS NOT NULL
            AND name IS NOT NULL;
    END IF;
END $$;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_library_rules_v2_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_library_rules_v2_updated_at ON library_rules_v2;

CREATE TRIGGER trigger_library_rules_v2_updated_at
  BEFORE UPDATE ON library_rules_v2
  FOR EACH ROW
  EXECUTE FUNCTION update_library_rules_v2_updated_at();

-- Note: Old tables are kept for rollback safety. They can be dropped in a future migration:
-- DROP TABLE IF EXISTS library_rules;
-- DROP TABLE IF EXISTS library_custom_rules;