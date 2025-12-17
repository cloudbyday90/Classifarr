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
    bot_token VARCHAR(500),
    channel_id VARCHAR(100),
    enabled BOOLEAN DEFAULT false,
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
    
    -- Clarification tracking
    clarification_status VARCHAR(20) DEFAULT 'none' CHECK (clarification_status IN ('none', 'pending', 'completed')),
    clarification_questions_asked INTEGER DEFAULT 0,
    clarification_questions_answered INTEGER DEFAULT 0,
    confidence_before_clarification DECIMAL(5,2),
    confidence_after_clarification DECIMAL(5,2),
    discord_message_id VARCHAR(100),
    
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

-- Confidence Thresholds (configurable thresholds for actions)
CREATE TABLE confidence_thresholds (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL UNIQUE CHECK (action_type IN ('auto_route', 'verify', 'clarify', 'manual')),
    min_confidence INTEGER NOT NULL,
    max_confidence INTEGER NOT NULL,
    notify_discord BOOLEAN DEFAULT true,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Clarification Questions (pre-defined questions the AI can ask)
CREATE TABLE clarification_questions (
    id SERIAL PRIMARY KEY,
    question_type VARCHAR(50) NOT NULL CHECK (question_type IN ('content_type', 'genre', 'audience', 'format', 'special', 'regional')),
    question_key VARCHAR(100) NOT NULL UNIQUE,
    question_text TEXT NOT NULL,
    applies_to VARCHAR(10) CHECK (applies_to IN ('movie', 'tv', 'both')),
    trigger_keywords TEXT[],
    trigger_genres TEXT[],
    trigger_languages TEXT[],
    options JSONB NOT NULL,
    priority INTEGER DEFAULT 10,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Clarification Responses (human responses to clarification questions)
CREATE TABLE clarification_responses (
    id SERIAL PRIMARY KEY,
    classification_id INTEGER REFERENCES classification_history(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES clarification_questions(id),
    question_key VARCHAR(100),
    question_text TEXT,
    selected_option JSONB,
    selected_value VARCHAR(100),
    applied_labels TEXT[],
    responded_by VARCHAR(100),
    responded_by_id VARCHAR(100),
    responded_via VARCHAR(20) DEFAULT 'discord',
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
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
CREATE INDEX idx_clarification_responses_classification ON clarification_responses(classification_id);
CREATE INDEX idx_clarification_responses_question ON clarification_responses(question_key);

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

-- Default Confidence Thresholds
INSERT INTO confidence_thresholds (action_type, min_confidence, max_confidence, notify_discord, description) VALUES
('auto_route', 90, 100, true, 'Automatically route without human interaction - just notify'),
('verify', 70, 89, true, 'Route but ask human to verify the decision'),
('clarify', 50, 69, true, 'Ask specific clarifying questions before routing'),
('manual', 0, 49, true, 'Require multiple clarifications - low confidence');

-- Pre-defined Clarification Questions
INSERT INTO clarification_questions (question_type, question_key, question_text, applies_to, trigger_keywords, trigger_genres, options) VALUES
-- Content Type Questions
('content_type', 'is_standup', 'Is this a stand-up comedy special?', 'movie', 
 ARRAY['stand-up', 'standup', 'comedy special', 'live comedy', 'comedian'],
 ARRAY['Comedy'],
 '[{"label": "Yes, Stand-Up Special", "value": "standup", "maps_to_labels": ["standup"]}, {"label": "No, Comedy Film", "value": "comedy_film", "maps_to_labels": ["comedy"]}, {"label": "Documentary about Comedy", "value": "documentary", "maps_to_labels": ["documentary"]}]'::jsonb),

('content_type', 'is_concert', 'Is this a concert/music performance film?', 'movie',
 ARRAY['concert', 'live performance', 'tour', 'live album'],
 ARRAY['Music', 'Documentary'],
 '[{"label": "Yes, Concert Film", "value": "concert", "maps_to_labels": ["concert"]}, {"label": "Music Documentary", "value": "music_doc", "maps_to_labels": ["documentary", "music"]}, {"label": "Musical/Fiction", "value": "musical", "maps_to_labels": ["music"]}]'::jsonb),

-- Genre/Format Questions
('genre', 'is_anime', 'Is this anime (Japanese animation)?', 'both',
 ARRAY['anime', 'manga', 'japanese animation', 'otaku'],
 ARRAY['Animation'],
 '[{"label": "Yes, Anime", "value": "anime", "maps_to_labels": ["anime"]}, {"label": "No, Western Animation", "value": "animation", "maps_to_labels": ["animation"]}, {"label": "No, Other Animation", "value": "other_animation", "maps_to_labels": ["animation"]}]'::jsonb),

('genre', 'is_kdrama', 'Is this a K-Drama (Korean drama series)?', 'tv',
 ARRAY['korean drama', 'k-drama', 'kdrama'],
 ARRAY['Drama'],
 '[{"label": "Yes, K-Drama", "value": "kdrama", "maps_to_labels": ["kdrama", "korean"]}, {"label": "No, Standard Drama", "value": "drama", "maps_to_labels": ["drama_tv"]}, {"label": "Korean but not K-Drama format", "value": "korean_other", "maps_to_labels": ["korean"]}]'::jsonb),

('genre', 'is_telenovela', 'Is this a telenovela/soap opera format?', 'tv',
 ARRAY['telenovela', 'soap opera', 'novela'],
 ARRAY['Drama', 'Soap'],
 '[{"label": "Yes, Telenovela/Soap", "value": "soap", "maps_to_labels": ["soap_opera"]}, {"label": "No, Standard Drama", "value": "drama", "maps_to_labels": ["drama_tv"]}]'::jsonb),

-- Audience Questions
('audience', 'adult_animation', 'This is animated - is it for adults or families?', 'both',
 ARRAY['adult animation', 'adult cartoon', 'mature animation'],
 ARRAY['Animation', 'Comedy'],
 '[{"label": "Adult Animation (R-rated)", "value": "adult", "maps_to_labels": ["adult_animation", "r"]}, {"label": "Family/Kids Animation", "value": "family", "maps_to_labels": ["animation", "family"]}, {"label": "Teen Animation", "value": "teen", "maps_to_labels": ["animation"]}]'::jsonb),

('audience', 'kids_or_family', 'Is this specifically for young children or general family?', 'both',
 NULL,
 ARRAY['Family', 'Animation'],
 '[{"label": "Young Kids (under 7)", "value": "kids", "maps_to_labels": ["kids", "tv_y", "tv_y7", "g"]}, {"label": "Family (all ages)", "value": "family", "maps_to_labels": ["family", "family_tv", "pg"]}, {"label": "Tweens/Teens", "value": "teen", "maps_to_labels": ["pg13", "tv_pg", "tv_14"]}]'::jsonb),

-- Special Content Questions  
('special', 'is_holiday', 'Is this holiday/Christmas themed content?', 'both',
 ARRAY['christmas', 'holiday', 'santa', 'xmas', 'thanksgiving', 'halloween'],
 NULL,
 '[{"label": "Yes, Christmas/Holiday", "value": "holiday", "maps_to_labels": ["holiday"]}, {"label": "Yes, Halloween", "value": "halloween", "maps_to_labels": ["halloween"]}, {"label": "No, not holiday themed", "value": "no", "maps_to_labels": []}]'::jsonb),

('special', 'is_superhero', 'Is this superhero/comic book content?', 'both',
 ARRAY['superhero', 'marvel', 'dc comics', 'comic book', 'based on comic'],
 ARRAY['Action', 'Science Fiction'],
 '[{"label": "Yes, Superhero/Comic", "value": "superhero", "maps_to_labels": ["superhero"]}, {"label": "No, regular action/sci-fi", "value": "no", "maps_to_labels": []}]'::jsonb),

-- Format Questions
('format', 'is_reality', 'What type of unscripted content is this?', 'tv',
 ARRAY['reality', 'competition', 'game show', 'dating'],
 ARRAY['Reality'],
 '[{"label": "Reality Competition (Survivor, etc.)", "value": "reality_competition", "maps_to_labels": ["reality_competition", "reality"]}, {"label": "Dating Show", "value": "dating", "maps_to_labels": ["dating_show", "reality"]}, {"label": "Game Show", "value": "game_show", "maps_to_labels": ["game_show"]}, {"label": "Lifestyle/Home", "value": "lifestyle", "maps_to_labels": ["home_lifestyle", "reality"]}, {"label": "Documentary/Docuseries", "value": "documentary", "maps_to_labels": ["documentary_tv"]}]'::jsonb),

('format', 'is_talk_show', 'Is this a talk show or late night format?', 'tv',
 ARRAY['talk show', 'late night', 'interview', 'chat show'],
 ARRAY['Talk', 'Comedy'],
 '[{"label": "Yes, Late Night/Talk Show", "value": "talk", "maps_to_labels": ["late_night", "talk"]}, {"label": "No, Scripted Comedy", "value": "comedy", "maps_to_labels": ["comedy_tv"]}]'::jsonb),

('format', 'is_miniseries', 'Is this a limited/mini series or ongoing?', 'tv',
 ARRAY['miniseries', 'limited series', 'mini-series'],
 NULL,
 '[{"label": "Yes, Limited/Mini Series", "value": "miniseries", "maps_to_labels": ["miniseries"]}, {"label": "No, Ongoing Series", "value": "ongoing", "maps_to_labels": []}]'::jsonb),

-- Regional Questions
('regional', 'british_production', 'Is this a British/UK production?', 'tv',
 ARRAY['bbc', 'itv', 'channel 4', 'british'],
 NULL,
 '[{"label": "Yes, British Production", "value": "british", "maps_to_labels": ["british"]}, {"label": "No", "value": "no", "maps_to_labels": []}]'::jsonb),

('regional', 'bollywood', 'Is this Bollywood or Indian regional cinema?', 'movie',
 NULL,
 NULL,
 '[{"label": "Yes, Bollywood", "value": "bollywood", "maps_to_labels": ["hindi"]}, {"label": "Indian Regional (not Bollywood)", "value": "regional", "maps_to_labels": ["hindi"]}, {"label": "No", "value": "no", "maps_to_labels": []}]'::jsonb);
