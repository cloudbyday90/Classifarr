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

-- v0.33.0: Add confidence_settings table for weighted formula configuration

-- Create confidence_settings table for storing weights and threshold
CREATE TABLE IF NOT EXISTS confidence_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default weights
INSERT INTO
    confidence_settings (setting_key, setting_value)
VALUES (
        'weight_source_library',
        '100'
    ),
    (
        'weight_manual_correction',
        '100'
    ),
    (
        'weight_existing_media',
        '100'
    ),
    ('weight_exact_match', '100'),
    (
        'weight_event_detection',
        '30'
    ),
    ('weight_custom_rule', '35'),
    (
        'weight_collection_match',
        '25'
    ),
    (
        'weight_learned_pattern',
        '20'
    ),
    (
        'weight_content_analysis',
        '15'
    ),
    ('weight_keyword_match', '10'),
    ('weight_genre_match', '10'),
    ('confidence_threshold', '80') ON CONFLICT (setting_key) DO NOTHING;

-- Add pending_reason column to classification_history for items awaiting decision
ALTER TABLE classification_history
ADD COLUMN IF NOT EXISTS pending_reason TEXT;

-- Add policy_question column to store AI-generated clarification questions
ALTER TABLE classification_history
ADD COLUMN IF NOT EXISTS policy_question JSONB;

-- Create index for pending items
CREATE INDEX IF NOT EXISTS idx_classification_history_pending ON classification_history (status)
WHERE
    status = 'pending';