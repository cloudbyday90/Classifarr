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

-- Migration: Replace B-tree created_at indexes with BRIN on append-only log tables
--
-- BACKGROUND: B-tree indexes have O(log N) lookup cost but high per-page overhead
-- (~6 bytes of index data per heap row). For tables where rows are only ever
-- inserted in time order (and never updated to have different timestamps), this
-- overhead is unnecessary.
--
-- BRIN (Block Range INdex) stores the min/max value for a configurable number of
-- heap pages (128 pages = ~1 MB of heap by default) rather than one entry per row.
-- For a table with good physical correlation between the indexed column and the
-- physical page order — exactly the situation for append-only log tables — BRIN:
--
--   * Is ~100–1,000× smaller than an equivalent B-tree
--   * Nearly as fast as B-tree for range scans (WHERE created_at > NOW() - INTERVAL '7 days')
--   * Has negligible write overhead (only updates the range summary when a new block range
--     is written, not per-row like B-tree)
--   * Requires no maintenance beyond normal VACUUM
--
-- TARGET TABLES (append-only, created_at monotonically increases):
--   - app_log:    application log entries, inserted in order
--   - error_log:  error/warning events, inserted in order
--   - audit_log:  security events, inserted in order
--
-- QUERY COMPATIBILITY:
--   The original indexes were used for:
--     WHERE created_at > $1      → fully supported by BRIN (range scan)
--     ORDER BY created_at DESC   → compatible; planner may use BRIN + sort or seqscan
--                                   on small tables (which is faster anyway)
--     WHERE created_at = $1      → BRIN can still eliminate blocks but less precise
--                                   than B-tree for point lookups; acceptable for logs
--
-- CONCURRENCY NOTE:
--   DROP INDEX and CREATE INDEX (without CONCURRENTLY) run inside this migration's
--   transaction. DROP INDEX acquires a brief SHARE lock (no writes blocked for longer
--   than the lock acquisition gap). For these small-to-medium log tables this is safe.
--   CONCURRENTLY is intentionally omitted because the migration runner wraps
--   each migration in BEGIN/COMMIT and CONCURRENTLY cannot run inside a transaction.
--
-- IDEMPOTENCY:
--   - DROP INDEX IF EXISTS is safe on re-run (no-op if already dropped)
--   - CREATE INDEX IF NOT EXISTS is safe on re-run (no-op if already created)

-- ─── app_log ──────────────────────────────────────────────────────────────────
-- Replace B-tree (descending) with BRIN. The BRIN index covers ascending range
-- queries; PostgreSQL scans from the latest BRIN range for DESC ORDER BY.
DROP INDEX IF EXISTS public.idx_app_log_created_at;
CREATE INDEX IF NOT EXISTS idx_app_log_created_at_brin
    ON public.app_log
    USING BRIN (created_at)
    WITH (pages_per_range = 128);

-- ─── error_log ────────────────────────────────────────────────────────────────
-- Preserving: idx_error_log_unresolved_stage (partial B-tree, different usage pattern)
-- Preserving: idx_error_log_unresolved_errors (partial B-tree, added in 20260307)
-- Only replacing the plain created_at B-tree.
DROP INDEX IF EXISTS public.idx_error_log_created_at;
CREATE INDEX IF NOT EXISTS idx_error_log_created_at_brin
    ON public.error_log
    USING BRIN (created_at)
    WITH (pages_per_range = 128);

-- ─── audit_log ────────────────────────────────────────────────────────────────
-- Security events are append-only; BRIN is a natural fit.
DROP INDEX IF EXISTS public.idx_audit_log_created_at;
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at_brin
    ON public.audit_log
    USING BRIN (created_at)
    WITH (pages_per_range = 128);
