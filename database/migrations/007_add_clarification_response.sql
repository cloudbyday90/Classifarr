-- Migration: Add clarification_response column to classification_history
-- Stores user responses to AI clarification questions for learning

-- Add clarification_response column
ALTER TABLE classification_history
ADD COLUMN IF NOT EXISTS clarification_response JSONB;

-- Add index for querying clarified items
CREATE INDEX IF NOT EXISTS idx_classification_history_clarified ON classification_history (clarification_status)
WHERE
    clarification_status IS NOT NULL;