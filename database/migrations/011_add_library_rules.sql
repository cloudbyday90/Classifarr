-- Migration: Add library_rules table for smart classification rules
-- Each library can define rules that determine what content belongs there

CREATE TABLE IF NOT EXISTS library_rules (
    id SERIAL PRIMARY KEY,
    library_id INTEGER NOT NULL REFERENCES libraries (id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL, -- 'rating', 'genre', 'keyword', 'language', 'year'
    operator VARCHAR(20) NOT NULL, -- 'includes', 'excludes', 'equals', 'contains', 'greater_than', 'less_than'
    value TEXT NOT NULL, -- The value to match (can be comma-separated for multiple values)
    is_exception BOOLEAN DEFAULT FALSE, -- If true, this rule overrides normal priority matching
    priority INTEGER DEFAULT 0, -- Order within library (lower = higher priority)
    description TEXT, -- Human-readable description of the rule
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient lookups
CREATE INDEX idx_library_rules_library_id ON library_rules (library_id);

CREATE INDEX idx_library_rules_type ON library_rules (rule_type);

CREATE INDEX idx_library_rules_exception ON library_rules (is_exception);

-- Add columns to libraries table for enhanced configuration
ALTER TABLE libraries
ADD COLUMN IF NOT EXISTS auto_learn BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS item_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS classified_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_confidence DECIMAL(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_analyzed_at TIMESTAMP
WITH
    TIME ZONE;

-- Insert some default rules for common library patterns
-- These are examples that can be customized per installation

-- Comment: Rules will be added dynamically based on library names and user configuration