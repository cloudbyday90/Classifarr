-- ===========================================
-- CLASSIFARR DATABASE SCHEMA
-- ===========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- SETTINGS TABLES
-- ===========================================

-- Global application settings
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ollama configuration
CREATE TABLE ollama_config (
    id SERIAL PRIMARY KEY,
    host VARCHAR(255) NOT NULL DEFAULT 'localhost',
    port INTEGER NOT NULL DEFAULT 11434,
    model VARCHAR(255) NOT NULL DEFAULT 'llama2',
    timeout INTEGER DEFAULT 30000,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TMDB configuration
CREATE TABLE tmdb_config (
    id SERIAL PRIMARY KEY,
    api_key VARCHAR(255),
    language VARCHAR(10) DEFAULT 'en-US',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification configuration (Discord)
CREATE TABLE notification_config (
    id SERIAL PRIMARY KEY,
    discord_bot_token TEXT,
    discord_channel_id VARCHAR(255),
    discord_enabled BOOLEAN DEFAULT false,
    send_on_classification BOOLEAN DEFAULT true,
    send_on_error BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- MEDIA SERVER TABLES
-- ===========================================

-- Media server configurations (Plex, Emby, Jellyfin)
CREATE TABLE media_server (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('plex', 'emby', 'jellyfin')),
    url VARCHAR(255) NOT NULL,
    api_key TEXT,
    username VARCHAR(255),
    password VARCHAR(255),
    enabled BOOLEAN DEFAULT true,
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Libraries discovered from media servers
CREATE TABLE libraries (
    id SERIAL PRIMARY KEY,
    media_server_id INTEGER REFERENCES media_server(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    library_key VARCHAR(255),
    path TEXT,
    media_type VARCHAR(50) CHECK (media_type IN ('movie', 'tv', 'mixed')),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- LABEL SYSTEM
-- ===========================================

-- Label presets (ratings, content types, genres)
CREATE TABLE label_presets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL CHECK (category IN ('rating', 'content_type', 'genre', 'custom')),
    description TEXT,
    color VARCHAR(7),
    system BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Library label assignments
CREATE TABLE library_labels (
    id SERIAL PRIMARY KEY,
    library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE,
    label_id INTEGER REFERENCES label_presets(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(library_id, label_id)
);

-- ===========================================
-- RULES SYSTEM
-- ===========================================

-- Custom rules for libraries (AI-generated or manual)
CREATE TABLE library_custom_rules (
    id SERIAL PRIMARY KEY,
    library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_json JSONB NOT NULL,
    media_type VARCHAR(50) CHECK (media_type IN ('movie', 'tv', 'both')),
    priority INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    generated_by VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- ARR CONFIGURATION
-- ===========================================

-- Radarr configuration
CREATE TABLE radarr_config (
    id SERIAL PRIMARY KEY,
    library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE,
    url VARCHAR(255) NOT NULL,
    api_key TEXT NOT NULL,
    quality_profile_id INTEGER,
    root_folder_path TEXT,
    tag VARCHAR(255),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sonarr configuration
CREATE TABLE sonarr_config (
    id SERIAL PRIMARY KEY,
    library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE,
    url VARCHAR(255) NOT NULL,
    api_key TEXT NOT NULL,
    quality_profile_id INTEGER,
    root_folder_path TEXT,
    tag VARCHAR(255),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- CLASSIFICATION SYSTEM
-- ===========================================

-- Classification history
CREATE TABLE classification_history (
    id SERIAL PRIMARY KEY,
    tmdb_id INTEGER NOT NULL,
    media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('movie', 'tv')),
    title VARCHAR(255) NOT NULL,
    year INTEGER,
    metadata JSONB,
    assigned_library_id INTEGER REFERENCES libraries(id) ON DELETE SET NULL,
    confidence_score DECIMAL(5,2),
    classification_method VARCHAR(100),
    reason TEXT,
    requested_by VARCHAR(255),
    overseerr_request_id INTEGER,
    routed_to_arr BOOLEAN DEFAULT false,
    arr_type VARCHAR(50),
    arr_response JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Classification corrections (learning data)
CREATE TABLE classification_corrections (
    id SERIAL PRIMARY KEY,
    classification_id INTEGER REFERENCES classification_history(id) ON DELETE CASCADE,
    original_library_id INTEGER REFERENCES libraries(id) ON DELETE SET NULL,
    corrected_library_id INTEGER REFERENCES libraries(id) ON DELETE SET NULL,
    corrected_by VARCHAR(255),
    discord_user_id VARCHAR(255),
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Learned patterns from corrections
CREATE TABLE learning_patterns (
    id SERIAL PRIMARY KEY,
    pattern_type VARCHAR(100) NOT NULL,
    pattern_key VARCHAR(255) NOT NULL,
    pattern_value TEXT,
    library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE,
    confidence_score DECIMAL(5,2) DEFAULT 0.5,
    occurrence_count INTEGER DEFAULT 1,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pattern_type, pattern_key, library_id)
);

-- ===========================================
-- SEED DATA
-- ===========================================

-- Default settings
INSERT INTO settings (key, value, description, category) VALUES
    ('app_port', '21324', 'Application port', 'general'),
    ('theme', 'dark', 'UI theme', 'ui'),
    ('auto_classify', 'true', 'Automatically classify new requests', 'classification'),
    ('require_confirmation', 'false', 'Require manual confirmation before routing to *arr', 'classification'),
    ('learning_enabled', 'true', 'Enable ML-based learning from corrections', 'classification'),
    ('notification_enabled', 'true', 'Enable Discord notifications', 'notifications');

-- Default Ollama config
INSERT INTO ollama_config (host, port, model, enabled) VALUES
    ('localhost', 11434, 'llama2', true);

-- Default TMDB config
INSERT INTO tmdb_config (enabled) VALUES (false);

-- Default notification config
INSERT INTO notification_config (discord_enabled) VALUES (false);

-- Label presets - Ratings
INSERT INTO label_presets (name, category, description, color, system) VALUES
    ('G', 'rating', 'General Audiences', '#4CAF50', true),
    ('PG', 'rating', 'Parental Guidance Suggested', '#8BC34A', true),
    ('PG-13', 'rating', 'Parents Strongly Cautioned', '#FFC107', true),
    ('R', 'rating', 'Restricted', '#FF9800', true),
    ('NC-17', 'rating', 'Adults Only', '#F44336', true),
    ('NR', 'rating', 'Not Rated', '#9E9E9E', true),
    ('TV-Y', 'rating', 'All Children', '#4CAF50', true),
    ('TV-Y7', 'rating', 'Directed to Older Children', '#8BC34A', true),
    ('TV-G', 'rating', 'General Audience', '#4CAF50', true),
    ('TV-PG', 'rating', 'Parental Guidance', '#FFC107', true),
    ('TV-14', 'rating', 'Parents Strongly Cautioned', '#FF9800', true),
    ('TV-MA', 'rating', 'Mature Audience', '#F44336', true);

-- Label presets - Content Types
INSERT INTO label_presets (name, category, description, color, system) VALUES
    ('Blockbuster', 'content_type', 'Major studio releases', '#2196F3', true),
    ('Independent', 'content_type', 'Independent films', '#9C27B0', true),
    ('Foreign', 'content_type', 'Foreign language films', '#00BCD4', true),
    ('Documentary', 'content_type', 'Documentary films', '#795548', true),
    ('Animated', 'content_type', 'Animated content', '#E91E63', true),
    ('Kids', 'content_type', 'Children content', '#FF5722', true),
    ('Classic', 'content_type', 'Classic films', '#607D8B', true),
    ('Holiday', 'content_type', 'Holiday themed', '#4CAF50', true);

-- Label presets - Genres
INSERT INTO label_presets (name, category, description, color, system) VALUES
    ('Action', 'genre', 'Action films', '#F44336', true),
    ('Adventure', 'genre', 'Adventure films', '#FF9800', true),
    ('Comedy', 'genre', 'Comedy films', '#FFEB3B', true),
    ('Drama', 'genre', 'Drama films', '#9C27B0', true),
    ('Horror', 'genre', 'Horror films', '#000000', true),
    ('Thriller', 'genre', 'Thriller films', '#424242', true),
    ('Science Fiction', 'genre', 'Sci-Fi films', '#2196F3', true),
    ('Fantasy', 'genre', 'Fantasy films', '#673AB7', true),
    ('Romance', 'genre', 'Romance films', '#E91E63', true),
    ('Crime', 'genre', 'Crime films', '#795548', true),
    ('Mystery', 'genre', 'Mystery films', '#607D8B', true),
    ('Western', 'genre', 'Western films', '#8D6E63', true),
    ('Animation', 'genre', 'Animated films', '#FF5722', true),
    ('Family', 'genre', 'Family films', '#4CAF50', true);

-- Create indexes for performance
CREATE INDEX idx_classification_history_tmdb_id ON classification_history(tmdb_id);
CREATE INDEX idx_classification_history_media_type ON classification_history(media_type);
CREATE INDEX idx_classification_history_created_at ON classification_history(created_at);
CREATE INDEX idx_learning_patterns_library_id ON learning_patterns(library_id);
CREATE INDEX idx_learning_patterns_pattern_type ON learning_patterns(pattern_type);
CREATE INDEX idx_libraries_media_server_id ON libraries(media_server_id);
CREATE INDEX idx_library_labels_library_id ON library_labels(library_id);
CREATE INDEX idx_library_labels_label_id ON library_labels(label_id);
