-- Migration: Standardize classification method names
-- Renames legacy method names to new standardized names

-- Update classification_history table
UPDATE classification_history
SET
    method = 'ai_analysis'
WHERE
    method = 'ai_fallback';

UPDATE classification_history
SET
    method = 'custom_rule'
WHERE
    method = 'rule_match';

UPDATE classification_history
SET
    method = 'custom_rule'
WHERE
    method = 'library_rule';

UPDATE classification_history
SET
    method = 'event_detection'
WHERE
    method = 'holiday_detection';

UPDATE classification_history
SET
    method = 'manual_correction'
WHERE
    method = 'learned_correction';