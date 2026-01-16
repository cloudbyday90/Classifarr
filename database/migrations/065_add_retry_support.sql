-- Migration: 065_add_retry_support.sql
-- Purpose: Add retry support for AI-unavailable scenarios
-- Related to: Comprehensive Classification System Fixes

-- Add retry columns to classification_history table
ALTER TABLE classification_history
ADD COLUMN IF NOT EXISTS retry_after TIMESTAMP,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;

-- Add index for efficient retry queue processing
CREATE INDEX IF NOT EXISTS idx_classification_history_retry_queue 
ON classification_history (retry_after, status)
WHERE status = 'pending_retry';

-- Update status constraint to include 'pending_retry'
ALTER TABLE classification_history
DROP CONSTRAINT IF EXISTS classification_history_status_check;

ALTER TABLE classification_history
ADD CONSTRAINT classification_history_status_check CHECK (
    status IN (
        'completed',         -- Classification finished successfully
        'failed',            -- Classification failed with error
        'corrected',         -- User corrected the classification
        'awaiting_decision', -- Pending user clarification/confirmation
        'pending',           -- In queue, not yet processed
        'pending_retry'      -- Queued for retry when AI becomes available
    )
);

-- Update method constraint to include 'queued_for_retry'
ALTER TABLE classification_history
DROP CONSTRAINT IF EXISTS classification_history_method_check;

ALTER TABLE classification_history 
ADD CONSTRAINT classification_history_method_check 
CHECK (method IN (
    -- CURRENT METHODS (v0.37.8c+)
    'existing_media',       -- Media already in library
    'manual_correction',    -- User correction from learned_corrections
    'exact_match',          -- Previously confirmed TMDB ID
    'learned_pattern',      -- Pattern-based matching (still active)
    'source_library',       -- Came from known media server library
    'policy_auto',          -- PolicyEngine auto-classification (>=85%)
    'policy_prompt',        -- PolicyEngine prompts for confirmation (60-84%)
    'ai_verified',          -- AI validation path
    'ai_analysis',          -- AI analysis for low-confidence
    'signal_calculation',   -- Fallback when AI unavailable
    'fallback',             -- Last resort fallback
    'queued_for_retry',     -- Queued for retry when AI becomes available

    -- LEGACY METHODS (kept for historical data, no longer set)
    'custom_rule',          -- Deprecated: replaced by PolicyEngine
    'rule_match',           -- Deprecated: replaced by PolicyEngine
    'ai_fallback',          -- Deprecated: replaced by ai_analysis
    'holiday_detection',    -- Deprecated: replaced by seasonal presets
    'library_rule'          -- Deprecated: replaced by PolicyEngine
));

-- Add comment to document the retry columns
COMMENT ON COLUMN classification_history.retry_after IS 
  'Timestamp when the classification should be retried (for AI unavailable scenarios)';
COMMENT ON COLUMN classification_history.retry_count IS 
  'Number of retry attempts made (max 3)';
COMMENT ON COLUMN classification_history.max_retries IS 
  'Maximum number of retry attempts allowed (default 3)';
