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

-- Migration: Add CHECK constraints to classification_history (NOT VALID — instant DDL)
--
-- Constraints are added NOT VALID so existing rows are not scanned at migration time.
-- This makes the DDL instant and non-blocking.
-- Run migration 20260305_130000_validate_classification_history_constraints.sql
-- separately (after a data-cleanup pass if needed) to validate existing rows.

-- Enforce confidence is a percentage between 0 and 100 (or NULL for unscored rows)
-- DO block guards idempotency: safe to re-run if migration was partially applied.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_classification_confidence_range'
          AND conrelid = 'public.classification_history'::regclass
    ) THEN
        ALTER TABLE public.classification_history
            ADD CONSTRAINT chk_classification_confidence_range
            CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100))
            NOT VALID;
    END IF;
END $$;

-- Enforce completed rows always reference a library
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_classification_completed_has_library'
          AND conrelid = 'public.classification_history'::regclass
    ) THEN
        ALTER TABLE public.classification_history
            ADD CONSTRAINT chk_classification_completed_has_library
            CHECK (status IS DISTINCT FROM 'completed' OR library_id IS NOT NULL)
            NOT VALID;
    END IF;
END $$;
