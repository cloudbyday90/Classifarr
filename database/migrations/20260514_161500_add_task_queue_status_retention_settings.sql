-- ============================================================================
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
-- ============================================================================
-- Migration: 20260514_161500_add_task_queue_status_retention_settings.sql
-- Purpose:
--   Extend task_queue cleanup to use status-aware retention windows instead of
--   one shared age limit for completed, failed, and cancelled rows.
--
-- Behavior:
--   - Preserves the existing completed-row setting:
--       settings.task_queue_retention_days (default 7)
--   - Adds failed-row retention:
--       settings.task_queue_failed_retention_days (default 30)
--   - Adds cancelled-row retention:
--       settings.task_queue_cancelled_retention_days (default 3)
--   - Normalizes invalid values to defaults while preserving valid
--     non-negative integers, including 0 to disable age cleanup per status.
-- ============================================================================

INSERT INTO settings (key, value)
VALUES
    ('task_queue_failed_retention_days', '30'),
    ('task_queue_cancelled_retention_days', '3')
ON CONFLICT (key) DO NOTHING;

UPDATE settings
SET value = CASE key
        WHEN 'task_queue_retention_days' THEN '7'
        WHEN 'task_queue_failed_retention_days' THEN '30'
        WHEN 'task_queue_cancelled_retention_days' THEN '3'
    END,
    updated_at = NOW()
WHERE key IN (
    'task_queue_retention_days',
    'task_queue_failed_retention_days',
    'task_queue_cancelled_retention_days'
)
  AND (
      value IS NULL
      OR value <> btrim(value)
      OR NOT (btrim(value) ~ '^[0-9]+$')
  );
