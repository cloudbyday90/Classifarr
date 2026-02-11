-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Migration: add rag loop error observability
-- Created: 2026-02-11T09:02:00.000Z
-- Purpose:
--   Expand error_log with second-pass stage observability fields.
-- Notes:
--   - No FK is added for classification_id to keep logging fail-open.
--   - Existing logs API remains backward-compatible.

ALTER TABLE error_log
  ADD COLUMN IF NOT EXISTS classification_id INTEGER,
  ADD COLUMN IF NOT EXISTS error_stage VARCHAR(50),
  ADD COLUMN IF NOT EXISTS reason_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS sql_state VARCHAR(10);

-- Normalize existing values to avoid constraint violations in partially-migrated environments.
UPDATE error_log
SET
  error_stage = CASE
    WHEN error_stage IN ('gate', 'enrichment', 'retrieval_pass2', 'policy_recheck', 'ai_rerun', 'trace')
      THEN error_stage
    ELSE NULL
  END,
  reason_code = CASE
    WHEN reason_code IS NULL THEN NULL
    WHEN btrim(reason_code) = '' THEN NULL
    ELSE btrim(reason_code)
  END,
  sql_state = CASE
    WHEN sql_state IS NULL THEN NULL
    WHEN upper(sql_state) ~ '^[A-Z0-9]{1,10}$' THEN upper(sql_state)
    ELSE NULL
  END;

CREATE INDEX IF NOT EXISTS idx_error_log_classification_id
  ON error_log(classification_id);

CREATE INDEX IF NOT EXISTS idx_error_log_stage_reason
  ON error_log(error_stage, reason_code);

CREATE INDEX IF NOT EXISTS idx_error_log_correlation_id
  ON error_log(correlation_id);

CREATE INDEX IF NOT EXISTS idx_error_log_unresolved_stage
  ON error_log(error_stage, created_at DESC)
  WHERE resolved = false AND error_stage IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'error_log_error_stage_check') THEN
    ALTER TABLE error_log
      ADD CONSTRAINT error_log_error_stage_check
      CHECK (
        error_stage IS NULL OR
        error_stage IN ('gate', 'enrichment', 'retrieval_pass2', 'policy_recheck', 'ai_rerun', 'trace')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'error_log_sql_state_format_check') THEN
    ALTER TABLE error_log
      ADD CONSTRAINT error_log_sql_state_format_check
      CHECK (sql_state IS NULL OR sql_state ~ '^[A-Z0-9]{1,10}$');
  END IF;
END $$;

COMMENT ON COLUMN error_log.classification_id IS 'Classification history identifier associated with this error event.';
COMMENT ON COLUMN error_log.error_stage IS 'Second-pass stage where the event occurred (gate, enrichment, retrieval_pass2, policy_recheck, ai_rerun, trace).';
COMMENT ON COLUMN error_log.reason_code IS 'Stable reason code used for aggregation and diagnostics.';
COMMENT ON COLUMN error_log.correlation_id IS 'Correlation identifier used to group related stage events.';
COMMENT ON COLUMN error_log.sql_state IS 'SQLSTATE code captured for database-related failures.';
