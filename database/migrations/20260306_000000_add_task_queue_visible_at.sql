-- Migration: Add visible_at to task_queue for visibility-timeout-based crash recovery
--
-- Visibility timeout pattern (per SQS / pgqueuer industry standard):
--   When a worker dequeues a task it sets visible_at = NOW() + interval.
--   If the worker crashes before completing/failing the task, visible_at expires
--   and another worker (or the periodic recovery job) can re-claim it.
--   This makes crash recovery continuous rather than only-at-startup.
--
-- Backward compatibility:
--   Rows that were processing before this migration will have visible_at = NULL.
--   The resetStaleProcessingTasks() age-guard handles these on the next restart.
--   The dequeue() OR clause only recovers rows WHERE visible_at IS NOT NULL,
--   so legacy NULL rows are unaffected until the next restart reset cleans them.
--
-- TASK_VISIBILITY_TIMEOUT_MINUTES env var (default 10) controls the window.

ALTER TABLE task_queue
    ADD COLUMN IF NOT EXISTS visible_at TIMESTAMPTZ DEFAULT NULL;

-- Index to make the dequeue() OR-branch fast:
-- WHERE status = 'processing' AND visible_at IS NOT NULL AND visible_at <= NOW()
CREATE INDEX IF NOT EXISTS idx_task_queue_visible_at
    ON task_queue (visible_at)
    WHERE status = 'processing' AND visible_at IS NOT NULL;
