/*
 * Migration: Add profile_snapshot column to classification_history
 * Version: 058
 * Description: Store library profile statistics snapshot at classification time
 * For Issue #142 (Epic #136 - v0.39.0-alpha)
 */

-- Add profile_snapshot column to classification_history table
ALTER TABLE classification_history
  ADD COLUMN IF NOT EXISTS profile_snapshot JSONB;

-- Add index for faster queries on profile snapshots
CREATE INDEX IF NOT EXISTS idx_classification_history_profile_snapshot 
  ON classification_history USING gin (profile_snapshot);

-- Add comment to document the column
COMMENT ON COLUMN classification_history.profile_snapshot IS 
  'Library profile statistics snapshot at classification time, used for AI prompt context';
