-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

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