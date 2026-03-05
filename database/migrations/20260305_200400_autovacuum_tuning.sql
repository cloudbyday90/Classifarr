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

-- Migration: Per-table autovacuum tuning for high-activity tables
--
-- BACKGROUND: PostgreSQL's global autovacuum triggers vacuum when dead tuples
-- exceed (autovacuum_vacuum_scale_factor × table_rows + autovacuum_vacuum_threshold).
-- The global default scale factor is 0.20 (20%), meaning for a 50,000-row table,
-- 10,000 dead tuples accumulate before autovacuum fires. This is fine for static
-- tables but problematic for tables with frequent updates or deletes.
--
-- High dead-tuple counts cause:
--   1. Table bloat — physical table file grows beyond logical data size
--   2. Index bloat — B-tree indexes accumulate dead index entries
--   3. Slower queries — more pages to scan, cache less effective
--   4. Slower autovacuum — more work to do each time it finally runs
--
-- This migration sets tighter per-table thresholds for the tables that benefit most.
-- These settings override global defaults locally without affecting other tables.
--
-- SAFETY: All autovacuum storage parameters can be changed with ALTER TABLE SET ()
-- with only a brief metadata lock (no table scan, no rewrite). Settings take effect
-- for the next autovacuum cycle.
--
-- ─────────────────────────────────────────────────────────────────────────────────
-- task_queue: very high churn (insert → process → complete/fail → potential delete)
--   scale_factor=0.01  → vacuum when 1% dead (50 rows on a 5,000-row queue)
--   threshold=50       → minimum 50 dead tuples (prevents over-eager vacuum on tiny tables)
--   analyze_scale=0.05 → analyze when 5% changed (keeps dequeue() planner stats fresh)
--   vacuum_cost_delay=2 → 2ms I/O delay between vacuum work units (aggressive but low-latency)
-- ─────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.task_queue SET (
    autovacuum_vacuum_scale_factor     = 0.01,
    autovacuum_vacuum_threshold        = 50,
    autovacuum_analyze_scale_factor    = 0.05,
    autovacuum_vacuum_cost_delay       = 2
);

-- ─────────────────────────────────────────────────────────────────────────────────
-- classification_history: ~50k-200k rows, status transitions after initial insert
--   scale_factor=0.05  → vacuum when 5% dead (2,500 dead rows on a 50k table)
--   analyze_scale=0.05 → analyze when 5% changed (keeps tsvector/status stats current)
-- ─────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.classification_history SET (
    autovacuum_vacuum_scale_factor     = 0.05,
    autovacuum_analyze_scale_factor    = 0.05
);

-- ─────────────────────────────────────────────────────────────────────────────────
-- app_log / error_log: append-mostly; scheduled cleanup job deletes old rows.
-- After a bulk delete, autovacuum needs to reclaim the freed space.
--   scale_factor=0.10  → vacuum when 10% dead (5k dead rows on a 50k log)
--   analyze_scale=0.10 → analyze when 10% inserted (keep date-range stats fresh for BRIN)
-- ─────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.app_log SET (
    autovacuum_vacuum_scale_factor     = 0.10,
    autovacuum_analyze_scale_factor    = 0.10
);

ALTER TABLE public.error_log SET (
    autovacuum_vacuum_scale_factor     = 0.10,
    autovacuum_analyze_scale_factor    = 0.10
);

-- ─────────────────────────────────────────────────────────────────────────────────
-- ai_usage_log: append-mostly; token cost tracking data.
--   scale_factor=0.10  → vacuum when 10% dead rows
--   analyze_scale=0.10 → analyze when 10% inserted
-- ─────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.ai_usage_log SET (
    autovacuum_vacuum_scale_factor     = 0.10,
    autovacuum_analyze_scale_factor    = 0.10
);

-- ─────────────────────────────────────────────────────────────────────────────────
-- audit_log: security events table; rows are never updated, only inserted/deleted.
--   scale_factor=0.05  → vacuum when 5% dead (tighter, since security logs matter)
--   analyze_scale=0.05 → analyze when 5% inserted (keep date index stats precise)
-- ─────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.audit_log SET (
    autovacuum_vacuum_scale_factor     = 0.05,
    autovacuum_analyze_scale_factor    = 0.05
);
