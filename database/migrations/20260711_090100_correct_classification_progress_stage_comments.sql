BEGIN;

COMMENT ON COLUMN task_queue.stage_started_at IS
  'When the current classification stage started';
COMMENT ON COLUMN task_queue.stage_history IS
  'JSON array of completed classification stages with timestamps and durations';

COMMIT;
