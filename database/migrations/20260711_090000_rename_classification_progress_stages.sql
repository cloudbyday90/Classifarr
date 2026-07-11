BEGIN;

ALTER TABLE task_queue RENAME COLUMN current_phase TO current_stage;
ALTER TABLE task_queue RENAME COLUMN phase_index TO stage_index;
ALTER TABLE task_queue RENAME COLUMN phase_started_at TO stage_started_at;
ALTER TABLE task_queue RENAME COLUMN phase_history TO stage_history;

ALTER INDEX idx_task_queue_active_phase RENAME TO idx_task_queue_active_stage;

UPDATE task_queue
SET stage_history = (
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN entry ? 'phase' THEN (entry - 'phase') || jsonb_build_object('stage', entry -> 'phase')
      ELSE entry
    END
    ORDER BY ordinal
  ), '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(stage_history, '[]'::jsonb)) WITH ORDINALITY AS history(entry, ordinal)
)
WHERE jsonb_typeof(stage_history) = 'array';

COMMENT ON COLUMN task_queue.current_stage IS
  'Current classification stage (queued, metadata_fetch, policy_eval, rag_analysis, signal_combine, ai_analysis, decision, notification)';
COMMENT ON COLUMN task_queue.stage_index IS 'Current classification stage index (1-8)';

COMMIT;
