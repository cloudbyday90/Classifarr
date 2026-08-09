-- ============================================================================
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
-- ============================================================================
-- Migration: 20260809_020000_add_task_queue_cleanup_origin.sql
-- Purpose:
--   Distinguish worker-startup, delayed-startup, and cron task_queue cleanup
--   records without changing the existing cleanup type or trigger contract.
-- ============================================================================

ALTER TABLE task_queue_cleanup_history
    ADD COLUMN IF NOT EXISTS cleanup_origin VARCHAR(32);

UPDATE task_queue_cleanup_history
SET cleanup_origin = 'legacy'
WHERE cleanup_origin IS NULL;

ALTER TABLE task_queue_cleanup_history
    ALTER COLUMN cleanup_origin SET DEFAULT 'legacy';

ALTER TABLE task_queue_cleanup_history
    ALTER COLUMN cleanup_origin SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'task_queue_cleanup_history_cleanup_origin_check'
          AND conrelid = 'task_queue_cleanup_history'::regclass
    ) THEN
        ALTER TABLE task_queue_cleanup_history
            ADD CONSTRAINT task_queue_cleanup_history_cleanup_origin_check
            CHECK (cleanup_origin IN ('legacy', 'worker_startup', 'startup_delayed', 'cron'));
    END IF;
END $$;
