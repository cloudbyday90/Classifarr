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

-- Migration: 20260307_000000_add_rag_log_cleanup_and_indexes.sql
--
-- 1. Seed the rag_log_retention_days setting so the scheduled log-cleanup job
--    can apply a configurable retention window to rag_logs (previously no
--    cleanup existed for this table). Default mirrors log_retention_days (30 d).
--
-- 2. Add a partial index on error_log for the common "unresolved ERROR-level"
--    query pattern used by the Command Center UI.  The existing
--    idx_error_log_unresolved_stage only covers rows where error_stage IS NOT
--    NULL, leaving general-purpose errors (no stage) unindexed for this filter.

-- 1. rag_log_retention_days setting (idempotent)
INSERT INTO settings (key, value)
VALUES ('rag_log_retention_days', '30')
ON CONFLICT (key) DO NOTHING;

-- 2. Partial index for unresolved ERROR-level entries (fast UI queries)
CREATE INDEX IF NOT EXISTS idx_error_log_unresolved_errors
  ON error_log (created_at DESC)
  WHERE resolved = false AND level = 'ERROR';
