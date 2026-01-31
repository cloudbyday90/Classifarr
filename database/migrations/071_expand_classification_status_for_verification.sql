-- Migration: 071_expand_classification_status_for_verification.sql
-- Purpose: Allow verification + reclassification status values in classification_history

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
        'pending_retry',     -- Queued for retry when AI becomes available
        'verified',          -- User verified classification (e.g., Discord confirmation)
        'reclassified'       -- Item was reclassified
    )
);
