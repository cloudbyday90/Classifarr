-- Migration: Add library_custom_rules table for complex rule builder rules
-- Supports multi-condition rules stored as JSONB

CREATE TABLE IF NOT EXISTS library_custom_rules (
    id SERIAL PRIMARY KEY,
    library_id INTEGER NOT NULL REFERENCES libraries (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_json JSONB NOT NULL, -- Stores array of conditions: [{field, operator, value}, ...]
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient lookups
CREATE INDEX idx_library_custom_rules_library_id ON library_custom_rules (library_id);