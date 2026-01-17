-- Migration: 068_add_classification_phase_tracking.sql
-- Issue #192: Add phase tracking columns to task_queue for classification progress indicator

-- Add phase tracking columns
ALTER TABLE task_queue
ADD COLUMN IF NOT EXISTS current_phase VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS phase_index INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS phase_started_at TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS phase_history JSONB DEFAULT '[]';

-- Index for active phase queries (partial index for processing tasks only)
CREATE INDEX IF NOT EXISTS idx_task_queue_active_phase ON task_queue (current_phase)
WHERE
    status = 'processing'
    AND current_phase IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN task_queue.current_phase IS 'Current classification phase (queued, metadata_fetch, policy_eval, rag_analysis, signal_combine, decision, notification)';

COMMENT ON COLUMN task_queue.phase_index IS 'Current phase index (1-7)';

COMMENT ON COLUMN task_queue.phase_started_at IS 'When the current phase started';

COMMENT ON COLUMN task_queue.phase_history IS 'JSON array of completed phases with timestamps and durations';