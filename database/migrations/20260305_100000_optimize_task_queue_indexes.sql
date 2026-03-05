/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Migration: Optimize task_queue indexes for dequeue() performance
 *
 * The dequeue() query pattern is:
 *   WHERE status = 'pending' AND next_retry_at <= NOW()
 *   ORDER BY priority DESC, created_at ASC
 *   FOR UPDATE SKIP LOCKED
 *
 * A composite partial index on (priority DESC, created_at ASC, next_retry_at ASC)
 * WHERE status = 'pending' allows the planner to satisfy the ORDER BY
 * priority+created_at directly from the index, while still supporting an
 * efficient index condition on next_retry_at <= NOW() for ready tasks.
 *
 * Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
 * Migrations run in a transaction (BEGIN/COMMIT), so CONCURRENTLY is omitted.
 * IF NOT EXISTS makes it safe to re-run (idempotent).
 */

-- Composite partial index for dequeue(): supports ORDER BY priority DESC, created_at ASC
-- and the next_retry_at <= NOW() range filter for pending tasks
CREATE INDEX IF NOT EXISTS idx_task_queue_dequeue
    ON task_queue (priority DESC, created_at ASC, next_retry_at ASC)
    WHERE status = 'pending';

-- Index for resetStaleProcessingTasks() and gracefulShutdown()
-- which query WHERE status = 'processing'
CREATE INDEX IF NOT EXISTS idx_task_queue_processing_stale
    ON task_queue (started_at ASC)
    WHERE status = 'processing';
