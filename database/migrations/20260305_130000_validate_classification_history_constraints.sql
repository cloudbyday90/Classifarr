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

ALTER TABLE public.classification_history
    VALIDATE CONSTRAINT chk_classification_confidence_range;

ALTER TABLE public.classification_history
    VALIDATE CONSTRAINT chk_classification_completed_has_library;
