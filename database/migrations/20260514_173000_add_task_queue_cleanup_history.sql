-- ============================================================================
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
-- ============================================================================
-- Migration: 20260514_173000_add_task_queue_cleanup_history.sql
-- Purpose:
--   Persist structured task_queue cleanup telemetry so operators can inspect
--   recurring trims, before/after row counts, and oldest retained timestamps.
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_queue_cleanup_history (
    id BIGSERIAL PRIMARY KEY,
    cleanup_type VARCHAR(32) NOT NULL CHECK (cleanup_type IN ('startup', 'scheduled')),
    trigger VARCHAR(32) NOT NULL CHECK (trigger IN ('age', 'count', 'age+count')),
    retention_policy JSONB NOT NULL,
    max_total_rows INTEGER NOT NULL CHECK (max_total_rows > 0),
    stale_rows_before INTEGER NOT NULL DEFAULT 0 CHECK (stale_rows_before >= 0),
    total_rows_before INTEGER NOT NULL DEFAULT 0 CHECK (total_rows_before >= 0),
    total_rows_after INTEGER NOT NULL DEFAULT 0 CHECK (total_rows_after >= 0),
    cap_excess_before INTEGER NOT NULL DEFAULT 0 CHECK (cap_excess_before >= 0),
    total_deleted INTEGER NOT NULL DEFAULT 0 CHECK (total_deleted >= 0),
    age_deleted INTEGER NOT NULL DEFAULT 0 CHECK (age_deleted >= 0),
    count_cap_deleted INTEGER NOT NULL DEFAULT 0 CHECK (count_cap_deleted >= 0),
    terminal_rows_before JSONB NOT NULL,
    terminal_rows_after JSONB NOT NULL,
    deleted_by_status JSONB NOT NULL,
    oldest_remaining_by_status JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_queue_cleanup_history_created_at
    ON task_queue_cleanup_history (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_queue_cleanup_history_type_created_at
    ON task_queue_cleanup_history (cleanup_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_queue_cleanup_history_cap_trim_created_at
    ON task_queue_cleanup_history (created_at DESC)
    WHERE count_cap_deleted > 0;
