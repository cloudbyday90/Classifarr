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

-- Migration: Set FILLFACTOR on high-churn tables to enable HOT updates
--
-- BACKGROUND: PostgreSQL uses MVCC — every UPDATE writes a new row version.
-- By default, pages are filled 100% (FILLFACTOR=100), leaving no room for the
-- new version on the same page. PostgreSQL must allocate space on a different
-- page, creating a "jump" in the heap chain.
--
-- Heap-Only Tuples (HOT) optimization: If the new row version fits on the SAME
-- heap page as the old one, PostgreSQL can perform a HOT update:
--   - No index entries are written for unchanged indexed columns
--   - Dead tuples on the page can be immediately recycled without autovacuum
--   - Index bloat is dramatically reduced
--
-- Setting FILLFACTOR < 100 leaves reserved space on each page for HOT chains.
-- This is beneficial only for tables with frequent in-place updates to rows.
--
-- TARGET TABLES:
--
--   task_queue (FILLFACTOR=75, 25% headroom):
--     Every task goes through multiple status transitions:
--       pending → processing → completed/failed
--     Each transition updates the status, started_at, completed_at, and
--     current_phase columns WITHOUT changing the row's indexed columns
--     (priority, created_at, next_retry_at are set at INSERT and not updated).
--     25% headroom gives ample space for HOT chains on the same page.
--
--   classification_history (FILLFACTOR=80, 20% headroom):
--     Records transition through several statuses (pending, completed, etc.)
--     and may have retry_count, retry_after, clarification_status updated
--     after initial INSERT. Indexed columns (tmdb_id, library_id, created_at)
--     are set at creation and never change, making HOT eligible.
--     20% headroom balances write amplification vs storage savings.
--
-- CAVEATS:
--   - FILLFACTOR only affects FUTURE page writes. Existing pages at 100% fill
--     will not be reclaimed until PostgreSQL rewrites them via UPDATE (HOT chain
--     fills the reserved space) or VACUUM FULL. Over time, as pages are naturally
--     rewritten, the full benefit is realized without any downtime.
--   - ALTER TABLE SET (fillfactor=...) takes only a brief metadata-level lock
--     (no table rewrite, no data movement). It is safe on live tables.
--   - A regular VACUUM or ANALYZE after this migration is harmless and will
--     allow new pages allocated after the FILLFACTOR change to use the setting
--     immediately, but is not required.

-- 25% headroom for HOT updates on status/phase columns
ALTER TABLE public.task_queue SET (fillfactor = 75);

-- 20% headroom for HOT updates on status/retry/clarification columns
ALTER TABLE public.classification_history SET (fillfactor = 80);
