-- Migration: 050_expand_classification_status.sql
-- Purpose: Add additional status values to classification_history check constraint

-- Drop the old constraint
ALTER TABLE classification_history
DROP CONSTRAINT IF EXISTS classification_history_status_check;

-- Add new constraint with all status values
ALTER TABLE classification_history
ADD CONSTRAINT classification_history_status_check CHECK (
    status IN (
        'completed', -- Classification finished successfully
        'failed', -- Classification failed with error
        'corrected', -- User corrected the classification
        'awaiting_decision', -- Pending user clarification/confirmation
        'pending' -- In queue, not yet processed
    )
);