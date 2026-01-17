-- Migration: 068_add_classification_phase_tracking.sql
-- Issue: #192 - Classification Progress Indicator on Activity Page with Phase Tracking
-- Adds phase tracking columns to task_queue for real-time progress display

-- Add phase tracking columns to task_queue
ALTER TABLE task_queue 
ADD COLUMN current_phase VARCHAR(50),
ADD COLUMN phase_index INTEGER,
ADD COLUMN phase_started_at TIMESTAMP,
ADD COLUMN phase_history JSONB DEFAULT '[]'::jsonb;

-- Add check constraint for valid phase values
ALTER TABLE task_queue 
ADD CONSTRAINT check_valid_phase 
CHECK (current_phase IS NULL OR current_phase IN (
  'queued',
  'metadata_fetch',
  'policy_eval',
  'rag_analysis',
  'signal_combine',
  'decision',
  'notification'
));

-- Add index for querying active classifications by phase
CREATE INDEX IF NOT EXISTS idx_task_queue_phase 
ON task_queue (status, current_phase, phase_index)
WHERE status = 'processing';

-- Add index for querying tasks by phase started time (for sorting by duration)
CREATE INDEX IF NOT EXISTS idx_task_queue_phase_started 
ON task_queue (phase_started_at)
WHERE phase_started_at IS NOT NULL;

-- Initialize phase for existing processing tasks
-- Set to 'queued' for tasks that are currently processing but have no phase set
UPDATE task_queue 
SET 
  current_phase = 'queued',
  phase_index = 1,
  phase_started_at = started_at,
  phase_history = jsonb_build_array(
    jsonb_build_object(
      'phase', 'queued',
      'started_at', started_at,
      'completed_at', NOW(),
      'duration_ms', EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
    )
  )
WHERE status = 'processing' AND current_phase IS NULL;

-- Record migration
INSERT INTO schema_migrations (filename, applied_at)
VALUES ('068_add_classification_phase_tracking.sql', NOW())
ON CONFLICT (filename) DO NOTHING;
