-- Migration 021: Add Dismissed Patterns Table
-- Tracks individually dismissed pattern suggestions per library

-- Track dismissed individual patterns
CREATE TABLE IF NOT EXISTS dismissed_patterns (
    id SERIAL PRIMARY KEY,
    library_id INTEGER REFERENCES libraries (id) ON DELETE CASCADE,
    pattern_type VARCHAR(50) NOT NULL, -- 'rating', 'genre', 'collection', 'studio', 'year', 'label'
    pattern_value VARCHAR(255) NOT NULL, -- The specific value like 'PG-13', 'Animation', etc.
    dismissed_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (
        library_id,
        pattern_type,
        pattern_value
    )
);

-- Index for quick lookups when filtering Available Library Filters
CREATE INDEX IF NOT EXISTS idx_dismissed_patterns_library ON dismissed_patterns (library_id);

-- Add pattern_sync_frequency to settings
INSERT INTO
    settings (key, value)
VALUES (
        'pattern_sync_frequency',
        'daily'
    ) ON CONFLICT (key) DO NOTHING;