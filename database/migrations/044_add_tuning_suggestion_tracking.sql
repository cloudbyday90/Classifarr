-- v0.37.0: Add tracking fields to policy_tuning_suggestions
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration adds fields to track when suggestions are applied and their
-- impact on policy accuracy.
-- 
-- Related Issue: #112
-- ═══════════════════════════════════════════════════════════════════════════

-- Add tracking fields for applied suggestions
ALTER TABLE policy_tuning_suggestions
ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS applied_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS before_accuracy REAL;

-- Add index for applied_at for filtering applied suggestions
CREATE INDEX IF NOT EXISTS idx_tuning_suggestions_applied_at ON policy_tuning_suggestions(applied_at);

COMMENT ON COLUMN policy_tuning_suggestions.applied_at IS 'Timestamp when suggestion was applied';
COMMENT ON COLUMN policy_tuning_suggestions.applied_by IS 'User who applied the suggestion';
COMMENT ON COLUMN policy_tuning_suggestions.before_accuracy IS 'Policy accuracy before applying suggestion (for impact tracking)';
