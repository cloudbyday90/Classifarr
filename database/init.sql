-- Classifarr Database Schema
-- Version: 1.0.0

-- ============================================
-- Table: library_definitions
-- Stores your customizable library rules
-- ============================================
CREATE TABLE library_definitions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('movie', 'tv')),
    description TEXT,
    rules TEXT[],
    priority INT DEFAULT 10,
    radarr_root_folder VARCHAR(255),
    sonarr_root_folder VARCHAR(255),
    quality_profile VARCHAR(100),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Table: classification_history
-- Logs every classification for analytics
-- ============================================
CREATE TABLE classification_history (
    id SERIAL PRIMARY KEY,
    tmdb_id INT NOT NULL,
    title VARCHAR(255),
    media_type VARCHAR(10),
    year VARCHAR(4),
    rating VARCHAR(20),
    genres TEXT[],
    keywords TEXT[],
    original_language VARCHAR(10),
    production_companies TEXT[],
    overview TEXT,
    ai_suggested_library VARCHAR(100),
    ai_confidence INT,
    ai_reason TEXT,
    final_library VARCHAR(100),
    was_corrected BOOLEAN DEFAULT false,
    requested_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Table: classification_corrections
-- Tracks user corrections for learning
-- ============================================
CREATE TABLE classification_corrections (
    id SERIAL PRIMARY KEY,
    tmdb_id INT NOT NULL,
    title VARCHAR(255),
    media_type VARCHAR(10),
    wrong_library VARCHAR(100) NOT NULL,
    correct_library VARCHAR(100) NOT NULL,
    reason TEXT,
    corrected_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Table: learning_patterns
-- Extracted patterns from corrections
-- ============================================
CREATE TABLE learning_patterns (
    id SERIAL PRIMARY KEY,
    pattern_type VARCHAR(50) NOT NULL, -- 'genre', 'keyword', 'company', 'language'
    pattern_value VARCHAR(255) NOT NULL,
    target_library VARCHAR(100) NOT NULL,
    media_type VARCHAR(10),
    confidence INT DEFAULT 50,
    occurrence_count INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(pattern_type, pattern_value, target_library, media_type)
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX idx_history_tmdb ON classification_history(tmdb_id);
CREATE INDEX idx_history_library ON classification_history(final_library);
CREATE INDEX idx_corrections_tmdb ON classification_corrections(tmdb_id);
CREATE INDEX idx_patterns_type ON learning_patterns(pattern_type, pattern_value);

-- ============================================
-- Insert default library definitions
-- ============================================
INSERT INTO library_definitions (name, media_type, description, rules, priority, radarr_root_folder, sonarr_root_folder) VALUES
-- Movies
('Anime Movies', 'movie', 'Japanese animated films', 
 ARRAY['Language is Japanese AND genre includes Animation', 'Production company is Japanese animation studio (Ghibli, Toei, MAPPA, etc.)', 'Has anime/manga related keywords'],
 20, '/movies/anime', NULL),

('Christmas and Hallmark', 'movie', 'Holiday movies and Hallmark-style romance',
 ARRAY['Christmas, holiday, or Santa themed content', 'Produced by Hallmark or Lifetime', 'Romantic comedy set during holidays'],
 15, '/movies/christmas', NULL),

('Comedy and Standup', 'movie', 'Stand-up comedy specials and comedy concert films',
 ARRAY['Stand-up comedy specials', 'Comedian performing on stage', 'Comedy concert or live performance'],
 15, '/movies/comedy', NULL),

('Family', 'movie', 'Family-friendly and kids movies',
 ARRAY['Rated G or PG', 'Animated films from Disney, Pixar, DreamWorks, Illumination', 'Genre includes Family, Animation, or Children', 'NOT Japanese animation'],
 10, '/movies/family', NULL),

('Movies', 'movie', 'All other movies - the default category',
 ARRAY['Any movie rated PG-13, R, or NC-17 (unless it fits another category)', 'Action, drama, thriller, horror, sci-fi, etc.', 'Default for any movie that doesn''t fit above categories'],
 1, '/movies/general', NULL),

-- TV Shows
('Anime', 'tv', 'Japanese animated TV series',
 ARRAY['Language is Japanese AND genre includes Animation', 'Production company is Japanese animation studio', 'Has anime/manga related keywords'],
 20, NULL, '/tv/anime'),

('Comedy/Live/Game Shows', 'tv', 'Shows where people appear as THEMSELVES, not acting',
 ARRAY['Late night shows (Fallon, Colbert, Kimmel, etc.)', 'Talk shows and interview shows', 'Game shows with prizes (Jeopardy, Wheel of Fortune)', 'Reality comedy where cast plays themselves (Impractical Jokers)', 'NOT scripted comedies'],
 15, NULL, '/tv/comedy-live'),

('Kids TV', 'tv', 'Childrens television programming',
 ARRAY['Rated TV-Y or TV-G', 'Cartoons aimed at children', 'Educational childrens content', 'NOT Japanese animation'],
 10, NULL, '/tv/kids'),

('Reality and Docuseries', 'tv', 'Documentaries and reality television',
 ARRAY['Documentary series', 'True crime series', 'Nature and wildlife documentaries', 'Reality TV competition shows', 'NOT game shows with prizes'],
 10, NULL, '/tv/reality'),

('TV Shows', 'tv', 'All other TV series - the default category',
 ARRAY['Any TV show rated TV-14 or TV-MA (unless it fits another category)', 'Scripted comedies, dramas, thrillers', 'Actors play fictional characters', 'Default for any TV that doesn''t fit above categories'],
 1, NULL, '/tv/general');

-- ============================================
-- Table: media_server
-- Connected media server (only one active)
-- ============================================
CREATE TABLE media_server (
    id SERIAL PRIMARY KEY,
    server_type VARCHAR(20) NOT NULL CHECK (server_type IN ('plex', 'emby', 'jellyfin')),
    name VARCHAR(100) DEFAULT 'Media Server',
    host VARCHAR(255) NOT NULL,
    port INT NOT NULL,
    api_key VARCHAR(255) NOT NULL,
    ssl BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Table: libraries 
-- Discovered from media server, user configures rules
-- ============================================
CREATE TABLE libraries (
    id SERIAL PRIMARY KEY,
    media_server_id INT REFERENCES media_server(id) ON DELETE CASCADE,
    external_id VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('movie', 'tv')),
    server_path VARCHAR(255),
    radarr_root_folder VARCHAR(255),
    sonarr_root_folder VARCHAR(255),
    quality_profile VARCHAR(100),
    priority INT DEFAULT 10,
    is_default BOOLEAN DEFAULT false,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(media_server_id, external_id)
);

-- ============================================
-- Table: library_rules
-- Classification rules for each library
-- ============================================
CREATE TABLE library_rules (
    id SERIAL PRIMARY KEY,
    library_id INT REFERENCES libraries(id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL,
    rule_value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Table: radarr_config
-- Radarr connection settings
-- ============================================
CREATE TABLE radarr_config (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) DEFAULT 'Radarr',
    host VARCHAR(255) NOT NULL,
    port INT DEFAULT 7878,
    api_key VARCHAR(255) NOT NULL,
    ssl BOOLEAN DEFAULT false,
    base_path VARCHAR(100) DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Table: sonarr_config
-- Sonarr connection settings
-- ============================================
CREATE TABLE sonarr_config (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) DEFAULT 'Sonarr',
    host VARCHAR(255) NOT NULL,
    port INT DEFAULT 8989,
    api_key VARCHAR(255) NOT NULL,
    ssl BOOLEAN DEFAULT false,
    base_path VARCHAR(100) DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Table: ollama_config
-- AI/Ollama connection settings
-- ============================================
CREATE TABLE ollama_config (
    id SERIAL PRIMARY KEY,
    host VARCHAR(255) DEFAULT 'localhost',
    port INT DEFAULT 11434,
    model VARCHAR(100) DEFAULT 'qwen3:14b',
    temperature DECIMAL(2,1) DEFAULT 0.3,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Table: notification_config
-- Discord and other notification settings
-- ============================================
CREATE TABLE notification_config (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL CHECK (type IN ('discord', 'slack', 'webhook')),
    name VARCHAR(100),
    webhook_url VARCHAR(500),
    enabled BOOLEAN DEFAULT true,
    on_classification BOOLEAN DEFAULT true,
    on_correction BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Table: settings
-- General application settings
-- ============================================
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default settings
INSERT INTO settings (key, value) VALUES
('app_name', 'Classifarr'),
('port', '21324'),
('theme', 'dark'),
('log_level', 'info');

-- Additional indexes
CREATE INDEX idx_libraries_media_server ON libraries(media_server_id);
CREATE INDEX idx_libraries_media_type ON libraries(media_type);
CREATE INDEX idx_library_rules_library ON library_rules(library_id);
