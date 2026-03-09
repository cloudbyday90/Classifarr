/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

-- Migration: 20260309_140000_task_queue_retention.sql
--
-- Root cause of OOM crash (March 2026):
--   task_queue accumulated 300 000+ completed rows with no TTL/retention policy.
--   The heavy NOT EXISTS / COUNT(*) queries that run every 5 minutes (gap
--   analysis, stats) scanned the entire bloated table under GC pressure,
--   driving the Node.js heap to its 4 GB auto-cap and triggering an OOM kill.
--
-- What this migration does:
--
--   1. Adds a partial B-tree index on created_at for completed/failed/cancelled
--      rows so that the daily scheduler cleanup (DELETE WHERE status IN (...) AND
--      created_at < NOW() - INTERVAL 'N days') runs in O(log n) instead of a
--      full sequential scan.  Without this index the cleanup is as expensive as
--      the original growth-inducing queries.
--
--   2. Seeds the `task_queue_retention_days` setting (default 7).  The scheduler
--      job reads this value; operators can raise it (e.g. 30) to retain more
--      history.  A value of 0 disables automatic cleanup.
--
--   3. One-time emergency purge: deletes completed/failed/cancelled rows older
--      than 7 days in batches of 10 000 to avoid locking the table for an
--      extended period.  Runs only if the bloated-row count exceeds 1 000.
--      Safe to re-run; the DELETE is idempotent.

-- 1. Partial cleanup index (O(log n) for TTL deletes)
CREATE INDEX IF NOT EXISTS idx_task_queue_cleanup
    ON task_queue (created_at)
    WHERE status IN ('completed', 'failed', 'cancelled');

-- 2. Retention-days setting (configurable, default 7 days)
INSERT INTO settings (key, value)
VALUES ('task_queue_retention_days', '7')
ON CONFLICT (key) DO NOTHING;

-- 3. One-time emergency purge (batched to avoid long locks).
--    Wrapped in a DO block so it only runs when significant bloat exists.
DO $$
DECLARE
    bloat_count  BIGINT;
    deleted_rows BIGINT;
    batch_rows   INT := 10000;
    total_deleted BIGINT := 0;
BEGIN
    SELECT COUNT(*) INTO bloat_count
    FROM task_queue
    WHERE status IN ('completed', 'failed', 'cancelled')
      AND created_at < NOW() - INTERVAL '7 days';

    IF bloat_count > 1000 THEN
        RAISE NOTICE 'task_queue emergency purge: % stale rows found, purging...', bloat_count;

        LOOP
            DELETE FROM task_queue
            WHERE id IN (
                SELECT id FROM task_queue
                WHERE status IN ('completed', 'failed', 'cancelled')
                  AND created_at < NOW() - INTERVAL '7 days'
                LIMIT batch_rows
            );

            GET DIAGNOSTICS deleted_rows = ROW_COUNT;
            total_deleted := total_deleted + deleted_rows;

            EXIT WHEN deleted_rows < batch_rows;
        END LOOP;

        RAISE NOTICE 'task_queue emergency purge complete: % rows deleted', total_deleted;
    ELSE
        RAISE NOTICE 'task_queue purge skipped: only % stale rows (threshold 1000)', bloat_count;
    END IF;
END $$;
