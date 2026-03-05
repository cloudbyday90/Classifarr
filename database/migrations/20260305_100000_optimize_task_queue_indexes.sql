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
 * A composite partial index on (next_retry_at, priority DESC, created_at)
 * WHERE status = 'pending' allows the planner to satisfy the WHERE clause,
 * range scan on next_retry_at, and sort on priority+created_at entirely
 * from the index — avoiding a sequential scan and sort step.
 *
 * Uses CONCURRENTLY to avoid AccessExclusiveLock on live instances.
 * IF NOT EXISTS makes it safe to re-run (idempotent).
 */

-- Composite partial index for dequeue(): matches WHERE + ORDER BY exactly
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_queue_dequeue
    ON task_queue (next_retry_at ASC, priority DESC, created_at ASC)
    WHERE status = 'pending';

-- Index for resetStaleProcessingTasks() and gracefulShutdown()
-- which query WHERE status = 'processing'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_queue_processing_stale
    ON task_queue (started_at ASC)
    WHERE status = 'processing';
