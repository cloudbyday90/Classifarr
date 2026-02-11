-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Migration: add rag loop trace query indexes
-- Created: 2026-02-11T09:03:00.000Z
-- Purpose:
--   Improve trace-mode and trace-outcome filtering performance for Issue 275
--   shadow analysis and operator audit queries.
-- Notes:
--   - This migration is index-only (no data backfill required).
--   - Avoid CREATE INDEX CONCURRENTLY because migrations run in a transaction.

CREATE INDEX IF NOT EXISTS idx_classification_history_rag_trace_mode
  ON classification_history (
    (metadata -> 'classification_details' -> 'rag_loop_trace' ->> 'mode')
  );

CREATE INDEX IF NOT EXISTS idx_classification_history_rag_trace_outcome
  ON classification_history (
    (metadata -> 'classification_details' -> 'rag_loop_trace' -> 'decision' ->> 'outcome')
  );

DO $$
BEGIN
  -- Add created_at support only when target DB lacks a usable created_at index.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'classification_history'
      AND indexdef ILIKE '%(created_at%'
  ) THEN
    CREATE INDEX idx_classification_history_created_at_desc
      ON classification_history (created_at DESC);
  END IF;
END $$;
