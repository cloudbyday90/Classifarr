/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Migration: Add partial index for hasClassificationDispatchBlocker()
 *
 * Problem:
 *   hasClassificationDispatchBlocker() runs the query:
 *
 *     SELECT EXISTS (
 *       SELECT 1 FROM task_queue
 *       WHERE task_type = 'classification' AND status = 'processing'
 *     )
 *
 *   This is called by every worker on every loop iteration (up to 5 concurrent
 *   workers, each polling every 1s, with zero sleep on the dispatch path). Under
 *   normal operating conditions the planner always chooses a sequential scan
 *   because pg_statistic sees the table as mostly-completed rows and estimates
 *   the 'processing' predicate as highly selective (low cost). At table sizes
 *   above ~1000 rows during an active classification burst, this turns into a
 *   multi-second sequential scan per worker, creating disk I/O saturation that
 *   cascades into slow DB operations across the entire server (including
 *   error_log inserts and recoverExpiredVisibilityTasks pool waits).
 *
 * Fix:
 *   A fully-qualified partial index predicated on both status = 'processing'
 *   AND task_type = 'classification'. This index will contain at most
 *   MAX_CONCURRENT (5) rows at any point in time. The EXISTS query becomes a
 *   trivial "is this partial index non-empty?" check, resolving in
 *   microseconds regardless of total table size. PostgreSQL will always choose
 *   this index over a seq scan when both predicates appear in the WHERE clause.
 *
 * Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
 * Migrations run in a transaction (BEGIN/COMMIT), so CONCURRENTLY is omitted.
 * IF NOT EXISTS makes it safe to re-run (idempotent).
 */

CREATE INDEX IF NOT EXISTS idx_task_queue_processing_classification
    ON task_queue (id)
    WHERE status = 'processing' AND task_type = 'classification';
