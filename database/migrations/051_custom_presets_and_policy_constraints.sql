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

-- Migration: 051_custom_presets_and_policy_constraints.sql
-- Purpose: Add custom presets support and enforce one policy per library

-- ============================================================================
-- 1. CUSTOM PRESETS TABLE
-- ============================================================================
-- Allows users to create their own presets with custom signals

CREATE TABLE IF NOT EXISTS custom_presets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(10) DEFAULT '⚙️',
    category VARCHAR(50) DEFAULT 'custom',

-- Signals (same structure as content_presets)
signals JSONB NOT NULL DEFAULT '{}',

-- Metadata
created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_custom_presets_category ON custom_presets (category);

-- ============================================================================
-- 2. ONE POLICY PER LIBRARY CONSTRAINT
-- ============================================================================
-- Each library should have exactly one policy (auto-created)

-- First, clean up duplicates - keep the policy with lowest ID per library
DELETE FROM policy_presets
WHERE
    policy_id IN (
        SELECT id
        FROM library_policies lp1
        WHERE
            EXISTS (
                SELECT 1
                FROM library_policies lp2
                WHERE
                    lp2.library_id = lp1.library_id
                    AND lp2.id < lp1.id
            )
    );

DELETE FROM library_policies lp1
WHERE
    EXISTS (
        SELECT 1
        FROM library_policies lp2
        WHERE
            lp2.library_id = lp1.library_id
            AND lp2.id < lp1.id
    );

-- Now add unique constraint
ALTER TABLE library_policies
DROP CONSTRAINT IF EXISTS library_policies_library_unique;

ALTER TABLE library_policies
ADD CONSTRAINT library_policies_library_unique UNIQUE (library_id);

-- ============================================================================
-- 3. AUTO-CREATE POLICIES FOR LIBRARIES WITHOUT ONE
-- ============================================================================
-- Any library without a policy gets a blank one created

INSERT INTO
    library_policies (
        library_id,
        name,
        description,
        enabled,
        priority,
        auto_classify_threshold,
        prompt_threshold
    )
SELECT l.id, l.name || ' Policy', 'Auto-generated policy for ' || l.name, true, 5, 85, 60
FROM libraries l
WHERE
    NOT EXISTS (
        SELECT 1
        FROM library_policies lp
        WHERE
            lp.library_id = l.id
    );

-- Log the migration
DO $$
DECLARE
    created_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO created_count 
    FROM library_policies lp
    WHERE lp.description LIKE 'Auto-generated%';
    
    IF created_count > 0 THEN
        RAISE NOTICE 'Created % auto-generated policies for libraries without one', created_count;
    END IF;
END $$;