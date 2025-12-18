-- ===========================================
-- MIGRATION 003: Media Server Content + Content Analysis + Confidence Clarification
-- ===========================================

-- ===========================================
-- PART 1: MEDIA SERVER CONTENT SCANNING
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
    media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('movie', 'tv')),
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

CREATE INDEX IF NOT EXISTS idx_media_items_tmdb ON media_server_items(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_media_items_library ON media_server_items(library_id);
CREATE INDEX IF NOT EXISTS idx_media_items_collections ON media_server_items USING GIN(collections);
CREATE INDEX IF NOT EXISTS idx_media_items_genres ON media_server_items USING GIN(genres);

-- Media Server Collections
CREATE TABLE IF NOT EXISTS media_server_collections (
    id SERIAL PRIMARY KEY,
    media_server_id INT REFERENCES media_server(id) ON DELETE CASCADE,
    library_id INT REFERENCES libraries(id) ON DELETE CASCADE,
    external_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    item_count INT DEFAULT 0,
    poster_url VARCHAR(500),
    metadata JSONB,
    last_synced TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(media_server_id, external_id)
);

-- Sync Status Tracking
CREATE TABLE IF NOT EXISTS media_server_sync_status (
    id SERIAL PRIMARY KEY,
    media_server_id INT REFERENCES media_server(id) ON DELETE CASCADE,
    library_id INT REFERENCES libraries(id),
    sync_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    items_total INT DEFAULT 0,
    items_processed INT DEFAULT 0,
    items_added INT DEFAULT 0,
    items_updated INT DEFAULT 0,
    items_removed INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===========================================
-- PART 2: CONTENT-AWARE CLASSIFICATION
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

-- Content Analysis Settings
INSERT INTO settings (key, value, description) VALUES
('content_analysis_enabled', 'true', 'Enable plot-based content analysis')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, description) VALUES
('content_analysis_min_confidence', '75', 'Minimum confidence to apply analysis')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, description) VALUES
('content_analysis_override_genres', 'true', 'Allow analysis to override TMDB genres')
ON CONFLICT (key) DO NOTHING;

-- ===========================================
-- PART 3: CONFIDENCE-BASED CLARIFICATION
-- ===========================================

-- Confidence Thresholds
CREATE TABLE IF NOT EXISTS confidence_thresholds (
    id SERIAL PRIMARY KEY,
    tier VARCHAR(20) NOT NULL UNIQUE,
    min_confidence INT NOT NULL,
    max_confidence INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT true
);

INSERT INTO confidence_thresholds (tier, min_confidence, max_confidence, action) VALUES
('auto', 90, 100, 'auto_route'),
('verify', 70, 89, 'route_and_verify'),
('clarify', 50, 69, 'ask_questions'),
('manual', 0, 49, 'manual_review')
ON CONFLICT (tier) DO NOTHING;

-- Clarification Questions
CREATE TABLE IF NOT EXISTS clarification_questions (
    id SERIAL PRIMARY KEY,
    question_type VARCHAR(50) NOT NULL,
    question_key VARCHAR(100) NOT NULL UNIQUE,
    question_text TEXT NOT NULL,
    applies_to VARCHAR(10) CHECK (applies_to IN ('movie', 'tv', 'both')),
    trigger_keywords TEXT[],
    trigger_genres TEXT[],
    trigger_languages TEXT[],
    options JSONB NOT NULL,
    priority INT DEFAULT 10,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Pre-defined questions
INSERT INTO clarification_questions (question_type, question_key, question_text, applies_to, trigger_keywords, trigger_genres, options) VALUES
('content_type', 'is_standup', 'Is this a stand-up comedy special?', 'movie', 
 ARRAY['stand-up', 'standup', 'comedy special'], ARRAY['Comedy'],
 '[{"label": "Yes, Stand-Up Special", "value": "standup", "maps_to_labels": ["standup"]}, {"label": "No, Comedy Film", "value": "comedy_film", "maps_to_labels": ["comedy"]}]'::jsonb),
('genre', 'is_anime', 'Is this anime (Japanese animation)?', 'both',
 ARRAY['anime', 'manga'], ARRAY['Animation'],
 '[{"label": "Yes, Anime", "value": "anime", "maps_to_labels": ["anime"]}, {"label": "No, Western Animation", "value": "animation", "maps_to_labels": ["animation"]}]'::jsonb),
('genre', 'is_kdrama', 'Is this a K-Drama?', 'tv',
 ARRAY['korean drama', 'k-drama'], ARRAY['Drama'],
 '[{"label": "Yes, K-Drama", "value": "kdrama", "maps_to_labels": ["kdrama", "korean"]}, {"label": "No, Standard Drama", "value": "drama", "maps_to_labels": ["drama_tv"]}]'::jsonb),
('audience', 'adult_animation', 'Is this adult animation or family?', 'both',
 ARRAY['adult animation'], ARRAY['Animation'],
 '[{"label": "Adult Animation", "value": "adult", "maps_to_labels": ["adult_animation"]}, {"label": "Family Animation", "value": "family", "maps_to_labels": ["animation", "family"]}]'::jsonb)
ON CONFLICT (question_key) DO NOTHING;

-- Clarification Responses
CREATE TABLE IF NOT EXISTS clarification_responses (
    id SERIAL PRIMARY KEY,
    classification_id INT REFERENCES classification_history(id),
    question_id INT REFERENCES clarification_questions(id),
    question_key VARCHAR(100),
    selected_value VARCHAR(100),
    applied_labels TEXT[],
    responded_by VARCHAR(255),
    responded_at TIMESTAMP DEFAULT NOW()
);

-- Add clarification columns to classification_history
ALTER TABLE classification_history ADD COLUMN IF NOT EXISTS clarification_status VARCHAR(20) DEFAULT 'none';
ALTER TABLE classification_history ADD COLUMN IF NOT EXISTS clarification_questions_asked INT DEFAULT 0;
ALTER TABLE classification_history ADD COLUMN IF NOT EXISTS confidence_before_clarification DECIMAL(5,2);
ALTER TABLE classification_history ADD COLUMN IF NOT EXISTS confidence_after_clarification DECIMAL(5,2);
ALTER TABLE classification_history ADD COLUMN IF NOT EXISTS discord_message_id VARCHAR(100);

-- ===========================================
-- INDEXES FOR PERFORMANCE
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_content_analysis_classification ON content_analysis_log(classification_id);
CREATE INDEX IF NOT EXISTS idx_content_analysis_tmdb ON content_analysis_log(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_clarification_responses_classification ON clarification_responses(classification_id);
CREATE INDEX IF NOT EXISTS idx_clarification_responses_question ON clarification_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_sync_status_server ON media_server_sync_status(media_server_id);
CREATE INDEX IF NOT EXISTS idx_sync_status_library ON media_server_sync_status(library_id);
