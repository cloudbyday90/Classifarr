-- Migration: Add unique constraint to library_rules to prevent duplicate rules
-- This ensures ON CONFLICT DO NOTHING works correctly

-- First, remove any existing duplicates (keep the one with lowest id)
DELETE FROM library_rules
WHERE
    id NOT IN(
        SELECT MIN(id)
        FROM library_rules
        GROUP BY
            library_id,
            rule_type,
            operator,
            value
    );

-- Add unique constraint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'library_rules_unique_rule') THEN
        ALTER TABLE library_rules
        ADD CONSTRAINT library_rules_unique_rule UNIQUE (
            library_id,
            rule_type,
            operator,
            value
        );
    END IF;
END $$;