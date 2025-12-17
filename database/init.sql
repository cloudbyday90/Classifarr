-- ===========================================
-- CLASSIFARR DATABASE SCHEMA
-- ===========================================

-- Drop existing tables (if any)
DROP TABLE IF EXISTS learning_patterns CASCADE;
DROP TABLE IF EXISTS classification_corrections CASCADE;
DROP TABLE IF EXISTS classification_history CASCADE;
DROP TABLE IF EXISTS library_custom_rules CASCADE;
DROP TABLE IF EXISTS library_labels CASCADE;
DROP TABLE IF EXISTS label_presets CASCADE;
DROP TABLE IF EXISTS libraries CASCADE;
DROP TABLE IF EXISTS media_server CASCADE;
DROP TABLE IF EXISTS radarr_config CASCADE;
DROP TABLE IF EXISTS sonarr_config CASCADE;
DROP TABLE IF EXISTS ollama_config CASCADE;
DROP TABLE IF EXISTS tmdb_config CASCADE;
DROP TABLE IF EXISTS notification_config CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- ===========================================
-- CORE TABLES
-- ===========================================

-- Media Server Configuration (Plex/Emby/Jellyfin)
CREATE TABLE media_server (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('plex', 'emby', 'jellyfin')),
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    api_key VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Libraries (discovered from media server)
CREATE TABLE libraries (
    id SERIAL PRIMARY KEY,
    media_server_id INTEGER REFERENCES media_server(id) ON DELETE CASCADE,
    external_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('movie', 'tv')),
    priority INTEGER DEFAULT 0,
    
    -- Radarr/Sonarr Mapping
    arr_type VARCHAR(20) CHECK (arr_type IN ('radarr', 'sonarr')),
    arr_id INTEGER,
    root_folder VARCHAR(500),
    quality_profile_id INTEGER,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(media_server_id, external_id)
);

-- Label Presets (system-defined classification labels)
CREATE TABLE label_presets (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL CHECK (category IN ('rating', 'content_type', 'genre')),
    label VARCHAR(100) NOT NULL,
    description TEXT,
    media_type VARCHAR(20) CHECK (media_type IN ('movie', 'tv', 'both')),
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(category, label)
);

-- Library Labels (assigned to libraries for include/exclude rules)
CREATE TABLE library_labels (
    id SERIAL PRIMARY KEY,
    library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE,
    label_preset_id INTEGER REFERENCES label_presets(id) ON DELETE CASCADE,
    rule_type VARCHAR(20) NOT NULL CHECK (rule_type IN ('include', 'exclude')),
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(library_id, label_preset_id)
);

-- Library Custom Rules (AI-generated JSON rules from chatbot)
CREATE TABLE library_custom_rules (
    id SERIAL PRIMARY KEY,
    library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_json JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ===========================================
-- SERVICE CONFIGURATIONS
-- ===========================================

-- Radarr Configuration
CREATE TABLE radarr_config (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    api_key VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Sonarr Configuration
CREATE TABLE sonarr_config (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    api_key VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Ollama Configuration
CREATE TABLE ollama_config (
    id SERIAL PRIMARY KEY,
    host VARCHAR(500) NOT NULL DEFAULT 'host.docker.internal',
    port INTEGER NOT NULL DEFAULT 11434,
    model VARCHAR(100) NOT NULL DEFAULT 'qwen3:14b',
    temperature DECIMAL(3,2) DEFAULT 0.30,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- TMDB Configuration
CREATE TABLE tmdb_config (
    id SERIAL PRIMARY KEY,
    api_key VARCHAR(500) NOT NULL,
    language VARCHAR(10) DEFAULT 'en-US',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Notification Configuration (Discord)
CREATE TABLE notification_config (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL DEFAULT 'discord',
    name VARCHAR(100),
    webhook_url VARCHAR(500),
    bot_token VARCHAR(500),
    channel_id VARCHAR(100),
    enabled BOOLEAN DEFAULT false,
    on_classification BOOLEAN DEFAULT true,
    on_correction BOOLEAN DEFAULT true,
    notify_on_error BOOLEAN DEFAULT false,
    notify_daily_summary BOOLEAN DEFAULT false,
    show_poster BOOLEAN DEFAULT true,
    show_confidence BOOLEAN DEFAULT true,
    show_reason BOOLEAN DEFAULT true,
    show_correction_buttons BOOLEAN DEFAULT true,
    quick_correct_count INT DEFAULT 3,
    show_library_dropdown BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- General Settings
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Table: webhook_config
-- Incoming webhook settings
-- ============================================
CREATE TABLE webhook_config (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) DEFAULT 'Overseerr',
    enabled BOOLEAN DEFAULT true,
    require_auth BOOLEAN DEFAULT false,
    api_key VARCHAR(255),
    ip_whitelist TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Table: webhook_log
-- Log of incoming webhooks
-- ============================================
CREATE TABLE webhook_log (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50),
    media_title VARCHAR(255),
    media_type VARCHAR(10),
    tmdb_id INT,
    status VARCHAR(20),
    error_message TEXT,
    ip_address VARCHAR(45),
    raw_payload JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for webhook logs
CREATE INDEX idx_webhook_log_created ON webhook_log(created_at DESC);

-- ===========================================
-- CLASSIFICATION & LEARNING TABLES
-- ===========================================

-- Classification History
CREATE TABLE classification_history (
    id SERIAL PRIMARY KEY,
    tmdb_id INTEGER NOT NULL,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('movie', 'tv')),
    title VARCHAR(500) NOT NULL,
    year INTEGER,
    
    -- Classification Result
    library_id INTEGER REFERENCES libraries(id) ON DELETE SET NULL,
    confidence DECIMAL(5,2),
    method VARCHAR(50) CHECK (method IN ('exact_match', 'learned_pattern', 'rule_match', 'ai_fallback')),
    reason TEXT,
    
    -- Metadata
    metadata JSONB,
    
    -- Status
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'corrected')),
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Classification Corrections (user feedback for learning)
CREATE TABLE classification_corrections (
    id SERIAL PRIMARY KEY,
    classification_id INTEGER REFERENCES classification_history(id) ON DELETE CASCADE,
    original_library_id INTEGER,
    corrected_library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE,
    corrected_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Learning Patterns (extracted from corrections)
CREATE TABLE learning_patterns (
    id SERIAL PRIMARY KEY,
    tmdb_id INTEGER,
    library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE,
    pattern_type VARCHAR(50),
    pattern_data JSONB,
    confidence DECIMAL(5,2),
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 100.00,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ===========================================
-- INDEXES FOR PERFORMANCE
-- ===========================================

CREATE INDEX idx_libraries_media_server ON libraries(media_server_id);
CREATE INDEX idx_libraries_media_type ON libraries(media_type);
CREATE INDEX idx_library_labels_library ON library_labels(library_id);
CREATE INDEX idx_library_custom_rules_library ON library_custom_rules(library_id);
CREATE INDEX idx_classification_history_tmdb ON classification_history(tmdb_id);
CREATE INDEX idx_classification_history_library ON classification_history(library_id);
CREATE INDEX idx_classification_corrections_classification ON classification_corrections(classification_id);
CREATE INDEX idx_learning_patterns_tmdb ON learning_patterns(tmdb_id);
CREATE INDEX idx_learning_patterns_library ON learning_patterns(library_id);

-- ===========================================
-- SEED DATA
-- ===========================================

-- Label Presets - Movie Ratings
INSERT INTO label_presets (category, label, description, media_type) VALUES
('rating', 'G', 'General Audiences - All ages admitted', 'movie'),
('rating', 'PG', 'Parental Guidance Suggested', 'movie'),
('rating', 'PG-13', 'Parents Strongly Cautioned - Some material may be inappropriate for children under 13', 'movie'),
('rating', 'R', 'Restricted - Under 17 requires accompanying parent or adult guardian', 'movie'),
('rating', 'NC-17', 'Adults Only - No one 17 and under admitted', 'movie'),
('rating', 'NR', 'Not Rated', 'both');

-- Label Presets - TV Ratings
INSERT INTO label_presets (category, label, description, media_type) VALUES
('rating', 'TV-Y', 'All Children - Appropriate for all children', 'tv'),
('rating', 'TV-Y7', 'Directed to Older Children - Designed for children age 7 and above', 'tv'),
('rating', 'TV-G', 'General Audience - Most parents would find this program suitable for all ages', 'tv'),
('rating', 'TV-PG', 'Parental Guidance Suggested - May contain material parents find unsuitable for younger children', 'tv'),
('rating', 'TV-14', 'Parents Strongly Cautioned - May be unsuitable for children under 14', 'tv'),
('rating', 'TV-MA', 'Mature Audience Only - Specifically designed for adults', 'tv');

-- Label Presets - Content Types
INSERT INTO label_presets (category, label, description, media_type) VALUES
('content_type', 'Animated', 'Animated content', 'both'),
('content_type', 'Anime', 'Japanese animation', 'both'),
('content_type', 'Holiday', 'Holiday-themed content', 'both'),
('content_type', 'Standup', 'Stand-up comedy specials', 'both'),
('content_type', 'Documentary', 'Non-fiction documentary content', 'both'),
('content_type', 'Reality', 'Reality television', 'tv'),
('content_type', 'Kids', 'Content specifically for children', 'both'),
('content_type', 'Family', 'Family-friendly content', 'both'),
('content_type', 'Foreign', 'Foreign language content', 'both'),
('content_type', 'Independent', 'Independent films', 'movie'),
('content_type', 'Short', 'Short films or episodes', 'both');

-- Label Presets - Genres
INSERT INTO label_presets (category, label, description, media_type) VALUES
('genre', 'Action', 'Action and adventure', 'both'),
('genre', 'Adventure', 'Adventure stories', 'both'),
('genre', 'Comedy', 'Comedy content', 'both'),
('genre', 'Drama', 'Dramatic content', 'both'),
('genre', 'Horror', 'Horror and thriller', 'both'),
('genre', 'Sci-Fi', 'Science fiction', 'both'),
('genre', 'Fantasy', 'Fantasy worlds', 'both'),
('genre', 'Mystery', 'Mystery and detective stories', 'both'),
('genre', 'Thriller', 'Suspense and thriller', 'both'),
('genre', 'Romance', 'Romantic stories', 'both'),
('genre', 'Crime', 'Crime stories', 'both'),
('genre', 'Western', 'Western genre', 'both'),
('genre', 'War', 'War films', 'both'),
('genre', 'Musical', 'Musicals', 'both'),
('genre', 'Biography', 'Biographical content', 'both'),
('genre', 'History', 'Historical content', 'both'),
('genre', 'Sport', 'Sports-related content', 'both');

-- Default Settings
INSERT INTO settings (key, value) VALUES
('port', '21324'),
('theme', 'dark'),
('app_name', 'Classifarr'),
('version', '1.0.0');

-- Default Ollama Configuration
INSERT INTO ollama_config (host, port, model, temperature, is_active) VALUES
('host.docker.internal', 11434, 'qwen3:14b', 0.30, true);

-- Insert default webhook config
INSERT INTO webhook_config (name, enabled) VALUES ('Overseerr', true);
