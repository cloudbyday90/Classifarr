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

-- Migration: Validate CHECK constraints on classification_history
--
-- VALIDATE CONSTRAINT acquires only a SHARE UPDATE EXCLUSIVE lock,
-- which allows concurrent reads and writes to continue during validation.
-- Run this migration after confirming no violating rows exist
-- (or after a data-cleanup pass).
--
-- Pre-check (run manually before applying this migration if unsure):
--   SELECT COUNT(*) FROM classification_history
--     WHERE confidence IS NOT NULL AND (confidence < 0 OR confidence > 100);
--   SELECT COUNT(*) FROM classification_history
--     WHERE status = 'completed' AND library_id IS NULL;

-- Data scrub: clamp confidence to 0-100 range.
-- Confidence should always be stored as a percentage (0-100) by the app, but
-- this guards against any historical data from before that convention was enforced.
UPDATE public.classification_history
SET confidence = LEAST(GREATEST(confidence, 0), 100)
WHERE confidence IS NOT NULL
  AND (confidence < 0 OR confidence > 100);

-- Data scrub: completed rows whose library was later deleted (ON DELETE SET NULL)
-- would violate chk_classification_completed_has_library.
-- Reclassify as 'failed' so the row remains meaningful and the constraint passes.
UPDATE public.classification_history
SET status        = 'failed',
    error_message = COALESCE(error_message, 'Library was deleted after this item was classified')
WHERE status    = 'completed'
  AND library_id IS NULL;

-- Validate confidence range constraint (idempotent: only runs if constraint is still NOT VALID)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname      = 'chk_classification_confidence_range'
          AND conrelid     = 'public.classification_history'::regclass
          AND NOT convalidated
    ) THEN
        EXECUTE 'ALTER TABLE public.classification_history VALIDATE CONSTRAINT chk_classification_confidence_range';
    END IF;
END $$;

-- Validate completed-has-library constraint (idempotent: only runs if constraint is still NOT VALID)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname      = 'chk_classification_completed_has_library'
          AND conrelid     = 'public.classification_history'::regclass
          AND NOT convalidated
    ) THEN
        EXECUTE 'ALTER TABLE public.classification_history VALIDATE CONSTRAINT chk_classification_completed_has_library';
    END IF;
END $$;
