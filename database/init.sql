-- ============================================
-- Classifarr Database Schema
-- ============================================

-- ============================================
-- Table: libraries
-- Radarr/Sonarr library definitions
-- ============================================
CREATE TABLE IF NOT EXISTS libraries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    media_type VARCHAR(10) CHECK (media_type IN ('movie', 'tv')) NOT NULL,
    radarr_id INT,
    sonarr_id INT,
    root_folder VARCHAR(255),
    quality_profile_id INT,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Table: label_presets
-- System-defined labels users can toggle
-- ============================================
CREATE TABLE label_presets (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,  -- 'rating', 'content_type', 'genre'
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    media_type VARCHAR(10) CHECK (media_type IN ('movie', 'tv', 'both')),
    description TEXT,
    tmdb_match_field VARCHAR(100),
    tmdb_match_values TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Table: library_labels
-- Labels enabled for each library
-- ============================================
CREATE TABLE library_labels (
    id SERIAL PRIMARY KEY,
    library_id INT REFERENCES libraries(id) ON DELETE CASCADE,
    label_preset_id INT REFERENCES label_presets(id) ON DELETE CASCADE,
    is_include BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(library_id, label_preset_id)
);

-- ============================================
-- Table: library_custom_rules
-- AI-generated custom rules from chatbot
-- ============================================
CREATE TABLE library_custom_rules (
    id SERIAL PRIMARY KEY,
    library_id INT REFERENCES libraries(id) ON DELETE CASCADE,
    rule_name VARCHAR(100),
    rule_description TEXT,
    rule_logic JSONB NOT NULL,
    is_include BOOLEAN DEFAULT true,
    priority INT DEFAULT 10,
    enabled BOOLEAN DEFAULT true,
    created_by_chat BOOLEAN DEFAULT false,
    chat_transcript TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Table: classifications
-- Store all classification decisions
-- ============================================
CREATE TABLE IF NOT EXISTS classifications (
    id SERIAL PRIMARY KEY,
    tmdb_id INT NOT NULL,
    media_type VARCHAR(10) CHECK (media_type IN ('movie', 'tv')) NOT NULL,
    title VARCHAR(255) NOT NULL,
    year INT,
    library_id INT REFERENCES libraries(id),
    confidence DECIMAL(5,2),
    reason TEXT,
    method VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tmdb_id ON classifications(tmdb_id, media_type);

-- ============================================
-- Table: corrections
-- User corrections for learning
-- ============================================
CREATE TABLE IF NOT EXISTS corrections (
    id SERIAL PRIMARY KEY,
    classification_id INT REFERENCES classifications(id),
    tmdb_id INT NOT NULL,
    media_type VARCHAR(10) CHECK (media_type IN ('movie', 'tv')) NOT NULL,
    original_library_id INT REFERENCES libraries(id),
    corrected_library_id INT REFERENCES libraries(id),
    corrected_by VARCHAR(100),
    correction_source VARCHAR(50), -- 'discord', 'web_ui', 'api'
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_corrections_tmdb ON corrections(tmdb_id, media_type);

-- ============================================
-- Table: learned_patterns
-- Patterns learned from corrections
-- ============================================
CREATE TABLE IF NOT EXISTS learned_patterns (
    id SERIAL PRIMARY KEY,
    pattern_type VARCHAR(50), -- 'genre_combo', 'keyword_match', 'director', etc.
    pattern_data JSONB NOT NULL,
    library_id INT REFERENCES libraries(id),
    confidence DECIMAL(5,2),
    match_count INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Table: rule_builder_sessions
-- Active chatbot sessions for rule building
-- ============================================
CREATE TABLE IF NOT EXISTS rule_builder_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    library_id INT REFERENCES libraries(id),
    media_type VARCHAR(10) CHECK (media_type IN ('movie', 'tv')),
    conversation JSONB NOT NULL,
    rule_draft JSONB,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'abandoned'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert preset labels for ratings, content types, and genres
-- Ratings (Movies)
INSERT INTO label_presets (category, name, display_name, media_type, tmdb_match_field, tmdb_match_values) VALUES
('rating', 'g', 'G', 'movie', 'certification', ARRAY['G']),
('rating', 'pg', 'PG', 'movie', 'certification', ARRAY['PG']),
('rating', 'pg13', 'PG-13', 'movie', 'certification', ARRAY['PG-13']),
('rating', 'r', 'R', 'movie', 'certification', ARRAY['R']),
('rating', 'nc17', 'NC-17', 'movie', 'certification', ARRAY['NC-17']);

-- Ratings (TV)
INSERT INTO label_presets (category, name, display_name, media_type, tmdb_match_field, tmdb_match_values) VALUES
('rating', 'tv_y', 'TV-Y', 'tv', 'certification', ARRAY['TV-Y']),
('rating', 'tv_y7', 'TV-Y7', 'tv', 'certification', ARRAY['TV-Y7']),
('rating', 'tv_g', 'TV-G', 'tv', 'certification', ARRAY['TV-G']),
('rating', 'tv_pg', 'TV-PG', 'tv', 'certification', ARRAY['TV-PG']),
('rating', 'tv_14', 'TV-14', 'tv', 'certification', ARRAY['TV-14']),
('rating', 'tv_ma', 'TV-MA', 'tv', 'certification', ARRAY['TV-MA']);

-- Content Types
INSERT INTO label_presets (category, name, display_name, media_type, description, tmdb_match_field, tmdb_match_values) VALUES
('content_type', 'animated', 'Animated', 'both', 'Animated content (non-anime)', 'genres', ARRAY['Animation']),
('content_type', 'anime', 'Anime', 'both', 'Japanese animation', 'keywords', ARRAY['anime', 'manga', 'based on manga', 'based on anime']),
('content_type', 'holiday', 'Holiday/Seasonal', 'both', 'Christmas, Halloween, holiday content', 'keywords', ARRAY['christmas', 'holiday', 'halloween', 'thanksgiving', 'easter', 'valentines day']),
('content_type', 'standup', 'Standup/Comedy Special', 'movie', 'Live comedy performances', 'keywords', ARRAY['stand-up comedy', 'comedy special', 'standup', 'stand up']),
('content_type', 'documentary', 'Documentary', 'both', 'Documentaries and docuseries', 'genres', ARRAY['Documentary']),
('content_type', 'reality', 'Reality', 'tv', 'Reality TV and competition shows', 'genres', ARRAY['Reality']),
('content_type', 'talk_show', 'Talk/Late Night', 'tv', 'Talk shows and late night', 'keywords', ARRAY['talk show', 'late night', 'interview']),
('content_type', 'game_show', 'Game Show', 'tv', 'Game shows with prizes', 'keywords', ARRAY['game show', 'quiz show', 'competition']),
('content_type', 'sports', 'Sports', 'both', 'Sports events and shows', 'genres', ARRAY['Sport']);

-- Genres
INSERT INTO label_presets (category, name, display_name, media_type, tmdb_match_field, tmdb_match_values) VALUES
('genre', 'action', 'Action', 'both', 'genres', ARRAY['Action']),
('genre', 'adventure', 'Adventure', 'both', 'genres', ARRAY['Adventure']),
('genre', 'comedy', 'Comedy', 'both', 'genres', ARRAY['Comedy']),
('genre', 'crime', 'Crime', 'both', 'genres', ARRAY['Crime']),
('genre', 'drama', 'Drama', 'both', 'genres', ARRAY['Drama']),
('genre', 'family', 'Family', 'both', 'genres', ARRAY['Family']),
('genre', 'fantasy', 'Fantasy', 'both', 'genres', ARRAY['Fantasy']),
('genre', 'horror', 'Horror', 'both', 'genres', ARRAY['Horror']),
('genre', 'mystery', 'Mystery', 'both', 'genres', ARRAY['Mystery']),
('genre', 'romance', 'Romance', 'both', 'genres', ARRAY['Romance']),
('genre', 'scifi', 'Science Fiction', 'both', 'genres', ARRAY['Science Fiction']),
('genre', 'thriller', 'Thriller', 'both', 'genres', ARRAY['Thriller']),
('genre', 'war', 'War', 'both', 'genres', ARRAY['War']),
('genre', 'western', 'Western', 'both', 'genres', ARRAY['Western']),
('genre', 'music', 'Music', 'both', 'genres', ARRAY['Music']),
('genre', 'history', 'History', 'both', 'genres', ARRAY['History']);
