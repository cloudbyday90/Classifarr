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

-- Migration: 20260313_120000_task_queue_insert_autovacuum.sql
--
-- ROOT CAUSE (March 2026 slow-INSERT incident):
--   A 251 K-row task_queue triggered a 586 ms INSERT latency spike because
--   PostgreSQL's query-planner statistics (pg_class.reltuples) were stale.
--   The planner believed the table had ~846 rows, so it chose index plans
--   calibrated to a tiny table, causing costly index-maintenance on every
--   INSERT into a 333 MB table.
--
--   The existing autovacuum settings (scale_factor=0.01, threshold=50) are
--   correct for dead-tuple cleanup, but they only use pg_stat n_dead_tup as
--   the trigger.  PostgreSQL 13+ tracks INSERT-only activity separately via
--   n_ins_since_vacuum / autovacuum_vacuum_insert_scale_factor.  The default
--   insert scale factor is 0.20, meaning pg_class.reltuples is not refreshed
--   until 20% of the table size worth of new inserts have accumulated — up to
--   50 000 inserts behind on a 251 K-row table.
--
-- WHAT THIS MIGRATION ADDS:
--
--   1. autovacuum_vacuum_insert_scale_factor = 0.02
--      Fires an INSERT-triggered vacuum (which updates reltuples / relpages)
--      once 2% of the current row count worth of new rows have been inserted.
--      On a 250 K-row table that is 5 000 inserts — far more timely than the
--      default 50 000.  The insert vacuum is lighter than a full vacuum; it
--      only marks newly inserted pages all-visible and updates catalog stats.
--
--   2. autovacuum_vacuum_insert_threshold = 500
--      Minimum absolute insert count before the insert-triggered vacuum fires
--      on an otherwise idle table (prevents over-eager vacuums when the queue
--      is nearly empty).
--
--   3. Ensures idx_task_queue_cleanup exists (idempotent CREATE INDEX IF NOT
--      EXISTS).  This index was added by migration 20260309_140000 but is
--      absent from the schema snapshot (current.sql was last regenerated
--      before that migration was written).  Adding it here keeps the schema
--      snapshot self-consistent once current.sql is updated.

-- ─── 1. INSERT-autovacuum parameters for task_queue ───────────────────────────
ALTER TABLE public.task_queue SET (
    autovacuum_vacuum_insert_scale_factor = 0.02,
    autovacuum_vacuum_insert_threshold    = 500
);

-- ─── 2. Cleanup index (idempotent — harmless if already present) ──────────────
-- Partial B-tree on created_at for completed/failed/cancelled rows.
-- Used by the daily scheduler cleanup and the startup drain so they both run
-- in O(log n) rather than a full sequential scan.
CREATE INDEX IF NOT EXISTS idx_task_queue_cleanup
    ON public.task_queue (created_at)
    WHERE status IN ('completed', 'failed', 'cancelled');
