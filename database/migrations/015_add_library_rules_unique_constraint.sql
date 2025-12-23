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
ALTER TABLE library_rules
ADD CONSTRAINT library_rules_unique_rule UNIQUE (
    library_id,
    rule_type,
    operator,
    value
);