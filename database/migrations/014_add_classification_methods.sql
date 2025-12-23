-- Migration: 014_add_classification_methods.sql
-- Purpose: Add new classification methods to check constraint

-- Drop the old constraint
ALTER TABLE classification_history 
DROP CONSTRAINT IF EXISTS classification_history_method_check;

-- Add new constraint with additional methods
ALTER TABLE classification_history 
ADD CONSTRAINT classification_history_method_check 
CHECK (method IN (
    'exact_match',
    'learned_pattern',
    'rule_match',
    'ai_fallback',
    'source_library',
    'holiday_detection',
    'library_rule',
    'existing_media'
));
