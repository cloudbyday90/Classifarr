-- Classifarr Database Schema
-- Version: 1.1.0

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
    is_include BOOLEAN DEFAULT true,
    priority INT DEFAULT 10,
    enabled BOOLEAN DEFAULT true,
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
    temperature DECIMAL(3,2) DEFAULT 0.30,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Table: tmdb_config
-- TMDB API settings
-- ============================================
CREATE TABLE tmdb_config (
    id SERIAL PRIMARY KEY,
    api_key VARCHAR(255) NOT NULL,
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
    poster_path VARCHAR(255),
    ai_suggested_library VARCHAR(100),
    ai_confidence INT,
    ai_reason TEXT,
    final_library VARCHAR(100),
    final_library_id INT REFERENCES libraries(id) ON DELETE SET NULL,
    was_corrected BOOLEAN DEFAULT false,
    requested_by VARCHAR(100),
    processed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Table: classification_corrections
-- Tracks user corrections for learning
-- ============================================
CREATE TABLE classification_corrections (
    id SERIAL PRIMARY KEY,
    classification_id INT REFERENCES classification_history(id) ON DELETE CASCADE,
    tmdb_id INT NOT NULL,
    title VARCHAR(255),
    media_type VARCHAR(10),
    wrong_library VARCHAR(100) NOT NULL,
    wrong_library_id INT REFERENCES libraries(id) ON DELETE SET NULL,
    correct_library VARCHAR(100) NOT NULL,
    correct_library_id INT REFERENCES libraries(id) ON DELETE SET NULL,
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
    pattern_type VARCHAR(50) NOT NULL,
    pattern_value VARCHAR(255) NOT NULL,
    target_library VARCHAR(100) NOT NULL,
    target_library_id INT REFERENCES libraries(id) ON DELETE CASCADE,
    media_type VARCHAR(10),
    confidence INT DEFAULT 50,
    occurrence_count INT DEFAULT 1,
    last_matched TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(pattern_type, pattern_value, target_library_id, media_type)
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

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX idx_libraries_media_type ON libraries(media_type);
CREATE INDEX idx_libraries_enabled ON libraries(enabled);
CREATE INDEX idx_history_tmdb ON classification_history(tmdb_id);
CREATE INDEX idx_history_library ON classification_history(final_library);
CREATE INDEX idx_history_date ON classification_history(created_at);
CREATE INDEX idx_corrections_tmdb ON classification_corrections(tmdb_id);
CREATE INDEX idx_corrections_date ON classification_corrections(created_at);
CREATE INDEX idx_patterns_type ON learning_patterns(pattern_type, pattern_value);
CREATE INDEX idx_patterns_library ON learning_patterns(target_library_id);

-- ============================================
-- Insert default settings
-- ============================================
INSERT INTO settings (key, value) VALUES
('app_name', 'Classifarr'),
('port', '21324'),
('theme', 'dark'),
('log_level', 'info'),
('version', '1.0.0');

-- ============================================
-- Insert default Ollama config
-- ============================================
INSERT INTO ollama_config (host, port, model, temperature) VALUES
('localhost', 11434, 'qwen3:14b', 0.30);
