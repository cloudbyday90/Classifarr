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

-- Migration: Upgrade primary key sequences and columns from INTEGER to BIGINT
--
-- BACKGROUND: PostgreSQL's SERIAL type creates a sequence with maximum value
-- 2,147,483,647 (2^31 - 1). If any primary key sequence ever reaches this value,
-- the next INSERT will fail with "integer out of range".
--
-- TWO-PART CHANGE per table:
--   1. ALTER SEQUENCE ... AS bigint
--      Changes the sequence's internal counter type so its max is 2^63-1.
--      This is instantaneous (metadata update only, no data scan).
--      Safe even when FK constraints exist — the sequence type is independent.
--
--   2. ALTER TABLE ... ALTER COLUMN id TYPE bigint
--      Widens the column from 4 bytes (int4) to 8 bytes (int8).
--      Requires a full table rewrite (AccessExclusiveLock for the duration).
--      NOT possible when other tables have FK constraints referencing the column,
--      because PostgreSQL requires referencing and referenced column types to match.
--
-- COMPATIBILITY NOTE for application code:
--   The pg driver returns BIGINT columns as JavaScript strings (to avoid precision 
--   loss for values > 2^53). A global int8 type-parser in database.js automatically 
--   converts safe-range bigint values to JS numbers, preserving backward compatibility
--   with all existing API responses and test assertions.
--
-- ─── Tables WITHOUT FK references to their id (safe for full column migration) ───
--
--   task_queue          — only outgoing FK (→ webhook_log), nothing references its id
--   app_log             — pure leaf table, no FK references
--   error_log           — pure leaf table, no FK references
--   audit_log           — pure leaf table, no FK references
--   ai_usage_log        — pure leaf table, no FK references
--
-- ─── Tables WITH FK references to their id (sequence-only migration) ────────────
--
--   classification_history — 9 tables reference classification_history(id):
--     • clarification_responses, classification_corrections, classification_embeddings,
--       content_analysis_log, embedding_errors, embedding_retry_queue,
--       media_requests, pattern_match_log, webhook_log
--     Changing the column type requires cascading the change to all referencing
--     columns or dropping and recreating 9 FK constraints. This is a planned
--     future migration. See MIGRATION_GUIDE.md for the detailed cascade plan.
--     The sequence is widened here (prevents sequence overflow at 2.1B) and the
--     column will be widened in a future maintenance migration.

-- ─── classification_history ───────────────────────────────────────────────────
-- Sequence widened; column migration deferred (see note above).
ALTER SEQUENCE public.classification_history_id_seq AS bigint;

-- Attempt column migration defensively: succeeds if FK constraints are not an
-- obstacle (e.g. fresh schema after FK columns are also widened), no-op otherwise.
DO $$
BEGIN
    ALTER TABLE public.classification_history ALTER COLUMN id TYPE bigint;
    RAISE NOTICE 'classification_history.id: column migrated to bigint.';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'classification_history.id: column type change deferred (FK constraints present). '
                 'Sequence is already widened to bigint. '
                 'SQLERRM: %', SQLERRM;
END $$;

-- ─── task_queue ───────────────────────────────────────────────────────────────
ALTER SEQUENCE public.task_queue_id_seq AS bigint;
ALTER TABLE  public.task_queue ALTER COLUMN id TYPE bigint;

-- ─── app_log ──────────────────────────────────────────────────────────────────
ALTER SEQUENCE public.app_log_id_seq AS bigint;
ALTER TABLE  public.app_log ALTER COLUMN id TYPE bigint;

-- ─── error_log ────────────────────────────────────────────────────────────────
ALTER SEQUENCE public.error_log_id_seq AS bigint;
ALTER TABLE  public.error_log ALTER COLUMN id TYPE bigint;

-- ─── audit_log ────────────────────────────────────────────────────────────────
ALTER SEQUENCE public.audit_log_id_seq AS bigint;
ALTER TABLE  public.audit_log ALTER COLUMN id TYPE bigint;

-- ─── ai_usage_log ─────────────────────────────────────────────────────────────
ALTER SEQUENCE public.ai_usage_log_id_seq AS bigint;
ALTER TABLE  public.ai_usage_log ALTER COLUMN id TYPE bigint;
