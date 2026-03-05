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

-- Migration: Enable pg_trgm for fuzzy title search and partial string matching
--
-- pg_trgm (trigram matching) breaks strings into 3-character overlapping sequences
-- and enables fast similarity searches, typo-tolerant queries, and accelerated
-- ILIKE '%partial%' matching via GIN/GIST indexes.
--
-- Without pg_trgm, a query like:
--   WHERE title ILIKE '%dark knight%'
-- requires a full sequential scan. With the GIN trigram index, the same query
-- uses an index scan and is orders of magnitude faster on large tables.
--
-- BENEFITS for Classifarr:
--   1. Fast partial title search in classification_history UI
--   2. Typo-tolerant matching: "Godfater" still finds "The Godfather"
--      via similarity() function (> 0.3 threshold is typical)
--   3. Accelerates ILIKE on title in any future search endpoints
--
-- USAGE examples after this migration:
--   -- Partial title search (index-accelerated):
--   SELECT * FROM classification_history
--   WHERE title ILIKE '%dark knight%'
--   LIMIT 50;
--
--   -- Similarity/typo-tolerant search:
--   SELECT *, similarity(title, 'Godfater') AS score
--   FROM classification_history
--   WHERE title % 'Godfater'          -- % operator uses similarity threshold
--   ORDER BY score DESC
--   LIMIT 10;
--
--   -- Adjust minimum similarity threshold (default 0.3):
--   SET pg_trgm.similarity_threshold = 0.2;
--
-- NOTES:
--   - pg_trgm is part of postgresql17-contrib, already installed in the image.
--   - No shared_preload_libraries entry needed (dynamically loaded).
--   - The GIN index below adds ~30-50% overhead on the title column size.
--     For classification_history with hundreds of thousands of rows this is 
--     typically 2-5 MB — negligible on any NAS deployment.
--   - IF NOT EXISTS on the index makes this migration idempotent and safe to re-run.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on classification_history.title.
-- Supports both ILIKE '%pattern%' and similarity-based (%) queries.
-- GIN chosen over GIST: GIN is faster for reads (more common), GIST for writes.
-- classification_history is mostly insert-once/read-many, making GIN optimal.
CREATE INDEX IF NOT EXISTS idx_classification_history_title_trgm
    ON public.classification_history
    USING GIN (title gin_trgm_ops);
