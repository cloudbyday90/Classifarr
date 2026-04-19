/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

-- Migration: Add CHECK constraint for policy threshold ladder (NOT VALID)
--
-- New and updated rows must satisfy:
--   0 <= prompt_threshold <= auto_classify_threshold <= 95
--
-- The constraint is added NOT VALID so existing rows are not scanned during
-- migration. This protects new writes immediately without forcing a full-table
-- validation pass as part of the Step 1 hardening rollout.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_library_policies_threshold_ladder'
          AND conrelid = 'public.library_policies'::regclass
    ) THEN
        ALTER TABLE public.library_policies
            ADD CONSTRAINT chk_library_policies_threshold_ladder
            CHECK (
                auto_classify_threshold >= 0
                AND auto_classify_threshold <= 95
                AND prompt_threshold >= 0
                AND prompt_threshold <= auto_classify_threshold
            )
            NOT VALID;
    END IF;
END $$;
