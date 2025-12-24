-- Migration 020: Add Pattern Analysis Tables
-- Tracks detected patterns and pending suggestions for dashboard notifications

-- Pattern analysis configuration (singleton)
CREATE TABLE IF NOT EXISTS pattern_analysis_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    analysis_frequency_hours INTEGER DEFAULT 8,
    minimum_confidence INTEGER DEFAULT 80,
    auto_suggest_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Insert default config if not exists
INSERT INTO
    pattern_analysis_config (id)
VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Track detected patterns per library for dashboard notifications
CREATE TABLE IF NOT EXISTS library_pattern_suggestions (
    id SERIAL PRIMARY KEY,
    library_id INTEGER REFERENCES libraries (id) ON DELETE CASCADE,
    detected_patterns JSONB NOT NULL DEFAULT '[]',
    pending_count INTEGER DEFAULT 0,
    last_analyzed TIMESTAMP DEFAULT NOW(),
    notification_dismissed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (library_id)
);

-- Index for quick dashboard lookups
CREATE INDEX IF NOT EXISTS idx_library_pattern_suggestions_pending ON library_pattern_suggestions (library_id)
WHERE
    pending_count > 0
    AND notification_dismissed = false;