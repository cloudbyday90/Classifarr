-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
--
-- The worker-health read separates active work from recently completed work.
-- These indexes cover each stable predicate without using a time-dependent
-- partial-index predicate, which PostgreSQL correctly rejects as non-immutable.

CREATE INDEX IF NOT EXISTS idx_task_queue_health_active
    ON task_queue (status, started_at DESC)
    WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_task_queue_health_completed
    ON task_queue (completed_at DESC) INCLUDE (started_at)
    WHERE status = 'completed';
