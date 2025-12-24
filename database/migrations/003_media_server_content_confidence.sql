/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

-- Migration: Media Server Content Scanning and Confidence-Based Classification

-- ===========================================
-- MEDIA SERVER CONTENT CACHE
-- ===========================================

-- Media Server Items Cache
CREATE TABLE IF NOT EXISTS media_server_items (
    id SERIAL PRIMARY KEY,
    media_server_id INT REFERENCES media_server(id) ON DELETE CASCADE,
    library_id INT REFERENCES libraries(id) ON DELETE CASCADE,
    external_id VARCHAR(100) NOT NULL,
    tmdb_id INT,
    imdb_id VARCHAR(20),
    tvdb_id INT,
    title VARCHAR(500) NOT NULL,
    original_title VARCHAR(500),
    year INT,
    media_type VARCHAR(10) NOT NULL,
    genres TEXT[],
    tags TEXT[],
    collections TEXT[],
    studio VARCHAR(255),
    content_rating VARCHAR(20),
    added_at TIMESTAMP,
    metadata JSONB,
    last_synced TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(media_server_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_media_items_tmdb ON media_server_items (tmdb_id);

CREATE INDEX IF NOT EXISTS idx_media_items_library ON media_server_items (library_id);

CREATE INDEX IF NOT EXISTS idx_media_items_media_server ON media_server_items (media_server_id);

CREATE INDEX IF NOT EXISTS idx_media_items_media_type ON media_server_items (media_type);

-- Media Server Collections
CREATE TABLE IF NOT EXISTS media_server_collections (
    id SERIAL PRIMARY KEY,
    media_server_id INT REFERENCES media_server (id) ON DELETE CASCADE,
    library_id INT REFERENCES libraries (id) ON DELETE CASCADE,
    external_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    item_count INT DEFAULT 0,
    last_synced TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (media_server_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_media_collections_library ON media_server_collections (library_id);

-- Sync Status Tracking
CREATE TABLE IF NOT EXISTS media_server_sync_status (
    id SERIAL PRIMARY KEY,
    media_server_id INT REFERENCES media_server (id) ON DELETE CASCADE,
    library_id INT REFERENCES libraries (id),
    sync_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (
        status IN (
            'pending',
            'running',
            'completed',
            'failed'
        )
    ),
    items_total INT DEFAULT 0,
    items_processed INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_status_media_server ON media_server_sync_status (media_server_id);

CREATE INDEX IF NOT EXISTS idx_sync_status_library ON media_server_sync_status (library_id);

CREATE INDEX IF NOT EXISTS idx_sync_status_status ON media_server_sync_status (status);

-- ===========================================
-- CONTENT TYPE ANALYSIS
-- ===========================================

-- Content Analysis Log
CREATE TABLE IF NOT EXISTS content_analysis_log (
    id SERIAL PRIMARY KEY,
    classification_id INT REFERENCES classification_history(id),
    tmdb_id INT,
    detected_type VARCHAR(50),
    confidence INT,
    reasoning TEXT[],
    suggested_labels TEXT[],
    overrides_genre BOOLEAN DEFAULT false,
    original_genres TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_analysis_classification ON content_analysis_log (classification_id);

CREATE INDEX IF NOT EXISTS idx_content_analysis_tmdb ON content_analysis_log (tmdb_id);

-- ===========================================
-- CONFIDENCE-BASED CLARIFICATION
-- ===========================================

-- Confidence Thresholds
CREATE TABLE IF NOT EXISTS confidence_thresholds (
    id SERIAL PRIMARY KEY,
    tier VARCHAR(20) NOT NULL UNIQUE,
    min_confidence INT NOT NULL,
    max_confidence INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO
    confidence_thresholds (
        tier,
        min_confidence,
        max_confidence,
        action,
        description
    )
VALUES (
        'auto',
        90,
        100,
        'auto_route',
        'Automatically route without interaction'
    ),
    (
        'verify',
        70,
        89,
        'verify_buttons',
        'Show Yes/No verification buttons'
    ),
    (
        'clarify',
        50,
        69,
        'clarify_questions',
        'Ask clarifying questions'
    ),
    (
        'manual',
        0,
        49,
        'manual_selection',
        'Request manual library selection'
    ) ON CONFLICT (tier) DO NOTHING;

-- Clarification Questions
CREATE TABLE IF NOT EXISTS clarification_questions (
    id SERIAL PRIMARY KEY,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL,
    trigger_keywords TEXT[],
    trigger_genres TEXT[],
    response_options JSONB NOT NULL,
    priority INT DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Clarification Responses
CREATE TABLE IF NOT EXISTS clarification_responses (
    id SERIAL PRIMARY KEY,
    classification_id INT REFERENCES classification_history (id),
    question_id INT REFERENCES clarification_questions (id),
    discord_user_id VARCHAR(100),
    response_value VARCHAR(100),
    response_label VARCHAR(255),
    confidence_before INT,
    confidence_after INT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clarification_responses_classification ON clarification_responses (classification_id);

CREATE INDEX IF NOT EXISTS idx_clarification_responses_question ON clarification_responses (question_id);

-- Add clarification fields to classification_history
ALTER TABLE classification_history
ADD COLUMN IF NOT EXISTS clarification_status VARCHAR(20);

ALTER TABLE classification_history
ADD COLUMN IF NOT EXISTS discord_message_id VARCHAR(100);

-- ===========================================
-- SETTINGS
-- ===========================================

INSERT INTO
    settings (key, value)
VALUES (
        'content_analysis_enabled',
        'true'
    ),
    (
        'content_analysis_min_confidence',
        '75'
    ) ON CONFLICT (key) DO NOTHING;

-- ===========================================
-- SEED DATA - CLARIFICATION QUESTIONS
-- ===========================================

INSERT INTO clarification_questions (question_text, question_type, trigger_keywords, trigger_genres, response_options, priority, enabled)
SELECT 'Is this a stand-up comedy special?', 'content_type', ARRAY['stand-up', 'comedy special', 'standup', 'live comedy'], ARRAY['Documentary', 'Comedy'], '{"yes": {"label": "Stand-Up Special", "confidence_boost": 30}, "no": {"label": "Regular Content", "confidence_boost": -10}}', 10, true
WHERE NOT EXISTS (SELECT 1 FROM clarification_questions WHERE question_text = 'Is this a stand-up comedy special?');

INSERT INTO clarification_questions (question_text, question_type, trigger_keywords, trigger_genres, response_options, priority, enabled)
SELECT 'Is this a concert or live music performance?', 'content_type', ARRAY['concert', 'live performance', 'tour', 'music festival'], ARRAY['Documentary', 'Music'], '{"yes": {"label": "Concert Film", "confidence_boost": 30}, "no": {"label": "Regular Content", "confidence_boost": -10}}', 9, true
WHERE NOT EXISTS (SELECT 1 FROM clarification_questions WHERE question_text = 'Is this a concert or live music performance?');

INSERT INTO clarification_questions (question_text, question_type, trigger_keywords, trigger_genres, response_options, priority, enabled)
SELECT 'Is this an adult animated show (like South Park, Family Guy)?', 'content_type', ARRAY['adult animation', 'adult cartoon', 'animated sitcom'], ARRAY['Animation', 'Comedy'], '{"yes": {"label": "Adult Animation", "confidence_boost": 30}, "no": {"label": "Family Animation", "confidence_boost": -10}}', 8, true
WHERE NOT EXISTS (SELECT 1 FROM clarification_questions WHERE question_text = 'Is this an adult animated show (like South Park, Family Guy)?');

INSERT INTO clarification_questions (question_text, question_type, trigger_keywords, trigger_genres, response_options, priority, enabled)
SELECT 'Is this a reality competition show?', 'content_type', ARRAY['reality', 'competition', 'contestants', 'elimination'], ARRAY['Reality', 'Documentary'], '{"yes": {"label": "Reality Competition", "confidence_boost": 30}, "no": {"label": "Regular Show", "confidence_boost": -10}}', 7, true
WHERE NOT EXISTS (SELECT 1 FROM clarification_questions WHERE question_text = 'Is this a reality competition show?');

INSERT INTO clarification_questions (question_text, question_type, trigger_keywords, trigger_genres, response_options, priority, enabled)
SELECT 'What language is this content primarily in?', 'language', ARRAY[]::TEXT[], ARRAY[]::TEXT[], '{"english": {"label": "English", "confidence_boost": 40}, "japanese": {"label": "Japanese", "confidence_boost": 40}, "korean": {"label": "Korean", "confidence_boost": 40}, "other": {"label": "Other Language", "confidence_boost": 0}}', 5, true
WHERE NOT EXISTS (SELECT 1 FROM clarification_questions WHERE question_text = 'What language is this content primarily in?');