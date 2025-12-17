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
    
    -- Radarr/Sonarr Mapping (legacy fields, maintained for backward compatibility and as fallbacks)
    -- New implementations should use radarr_settings/sonarr_settings JSONB fields
    arr_type VARCHAR(20) CHECK (arr_type IN ('radarr', 'sonarr')),
    arr_id INTEGER,
    root_folder VARCHAR(500),
    quality_profile_id INTEGER,
    
    -- Full Radarr/Sonarr Settings (preferred method for new implementations)
    radarr_settings JSONB DEFAULT '{}',
    sonarr_settings JSONB DEFAULT '{}',
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(media_server_id, external_id)
);

-- Label Presets (system-defined classification labels)
CREATE TABLE label_presets (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL CHECK (category IN ('rating', 'content_type', 'genre', 'language')),
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    media_type VARCHAR(20) CHECK (media_type IN ('movie', 'tv', 'both')),
    tmdb_match_field VARCHAR(50),
    tmdb_match_values TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(category, name)
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

-- Tavily Configuration
CREATE TABLE tavily_config (
    id SERIAL PRIMARY KEY,
    api_key VARCHAR(255),
    search_depth VARCHAR(20) DEFAULT 'basic', -- 'basic' or 'advanced'
    max_results INT DEFAULT 5,
    include_domains TEXT[] DEFAULT ARRAY['imdb.com', 'rottentomatoes.com', 'myanimelist.net', 'letterboxd.com'],
    exclude_domains TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ARR Profiles Cache (for UI dropdowns)
CREATE TABLE arr_profiles_cache (
    id SERIAL PRIMARY KEY,
    arr_type VARCHAR(10) NOT NULL CHECK (arr_type IN ('radarr', 'sonarr')),
    profile_type VARCHAR(50) NOT NULL CHECK (profile_type IN ('root_folder', 'quality_profile', 'tag')),
    profile_id INT NOT NULL,
    profile_name VARCHAR(255),
    profile_path VARCHAR(500),
    profile_data JSONB,
    last_synced TIMESTAMP DEFAULT NOW(),
    UNIQUE(arr_type, profile_type, profile_id)
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
CREATE INDEX idx_arr_profiles_cache_type ON arr_profiles_cache(arr_type, profile_type);

-- ============================================
-- SEED DATA - LABEL PRESETS
-- Comprehensive Media Classification (83 labels)
-- ============================================

-- ============================================
-- MOVIE RATINGS (6)
-- ============================================
INSERT INTO label_presets (category, name, display_name, media_type, description, tmdb_match_field, tmdb_match_values) VALUES
('rating', 'g', 'G', 'movie', 'General Audiences - All ages admitted', 'certification', ARRAY['G']),
('rating', 'pg', 'PG', 'movie', 'Parental Guidance Suggested', 'certification', ARRAY['PG']),
('rating', 'pg13', 'PG-13', 'movie', 'Parents Strongly Cautioned - Some material may be inappropriate for children under 13', 'certification', ARRAY['PG-13']),
('rating', 'r', 'R', 'movie', 'Restricted - Under 17 requires accompanying parent or adult guardian', 'certification', ARRAY['R']),
('rating', 'nc17', 'NC-17', 'movie', 'Adults Only - No one 17 and under admitted', 'certification', ARRAY['NC-17']),
('rating', 'unrated', 'Unrated', 'movie', 'Not Rated or Unrated', 'certification', ARRAY['NR', 'Unrated']);

-- ============================================
-- TV RATINGS (6)
-- ============================================
INSERT INTO label_presets (category, name, display_name, media_type, description, tmdb_match_field, tmdb_match_values) VALUES
('rating', 'tv_y', 'TV-Y', 'tv', 'All Children - Appropriate for all children', 'certification', ARRAY['TV-Y']),
('rating', 'tv_y7', 'TV-Y7', 'tv', 'Directed to Older Children - Designed for children age 7 and above', 'certification', ARRAY['TV-Y7']),
('rating', 'tv_g', 'TV-G', 'tv', 'General Audience - Most parents would find this program suitable for all ages', 'certification', ARRAY['TV-G']),
('rating', 'tv_pg', 'TV-PG', 'tv', 'Parental Guidance Suggested - May contain material parents find unsuitable for younger children', 'certification', ARRAY['TV-PG']),
('rating', 'tv_14', 'TV-14', 'tv', 'Parents Strongly Cautioned - May be unsuitable for children under 14', 'certification', ARRAY['TV-14']),
('rating', 'tv_ma', 'TV-MA', 'tv', 'Mature Audience Only - Specifically designed for adults', 'certification', ARRAY['TV-MA']);

-- ============================================
-- MOVIE GENRES (18)
-- ============================================
INSERT INTO label_presets (category, name, display_name, media_type, description, tmdb_match_field, tmdb_match_values) VALUES
('genre', 'action', 'Action', 'movie', 'Action movies', 'genres', ARRAY['Action']),
('genre', 'adventure', 'Adventure', 'movie', 'Adventure movies', 'genres', ARRAY['Adventure']),
('genre', 'animation', 'Animation', 'movie', 'Animated movies', 'genres', ARRAY['Animation']),
('genre', 'comedy', 'Comedy', 'movie', 'Comedy movies', 'genres', ARRAY['Comedy']),
('genre', 'crime', 'Crime', 'movie', 'Crime movies', 'genres', ARRAY['Crime']),
('genre', 'documentary', 'Documentary', 'movie', 'Documentary movies', 'genres', ARRAY['Documentary']),
('genre', 'drama', 'Drama', 'movie', 'Drama movies', 'genres', ARRAY['Drama']),
('genre', 'family', 'Family', 'movie', 'Family movies', 'genres', ARRAY['Family']),
('genre', 'fantasy', 'Fantasy', 'movie', 'Fantasy movies', 'genres', ARRAY['Fantasy']),
('genre', 'history', 'History', 'movie', 'Historical movies', 'genres', ARRAY['History']),
('genre', 'horror', 'Horror', 'movie', 'Horror movies', 'genres', ARRAY['Horror']),
('genre', 'music', 'Music', 'movie', 'Music movies', 'genres', ARRAY['Music']),
('genre', 'mystery', 'Mystery', 'movie', 'Mystery movies', 'genres', ARRAY['Mystery']),
('genre', 'romance', 'Romance', 'movie', 'Romance movies', 'genres', ARRAY['Romance']),
('genre', 'scifi', 'Science Fiction', 'movie', 'Science fiction movies', 'genres', ARRAY['Science Fiction']),
('genre', 'thriller', 'Thriller', 'movie', 'Thriller movies', 'genres', ARRAY['Thriller']),
('genre', 'war', 'War', 'movie', 'War movies', 'genres', ARRAY['War']),
('genre', 'western', 'Western', 'movie', 'Western movies', 'genres', ARRAY['Western']);

-- ============================================
-- TV GENRES (16)
-- ============================================
INSERT INTO label_presets (category, name, display_name, media_type, description, tmdb_match_field, tmdb_match_values) VALUES
('genre', 'action_adventure', 'Action & Adventure', 'tv', 'Action & Adventure TV shows', 'genres', ARRAY['Action & Adventure']),
('genre', 'animation_tv', 'Animation', 'tv', 'Animated TV shows', 'genres', ARRAY['Animation']),
('genre', 'comedy_tv', 'Comedy', 'tv', 'Comedy TV shows', 'genres', ARRAY['Comedy']),
('genre', 'crime_tv', 'Crime', 'tv', 'Crime TV shows', 'genres', ARRAY['Crime']),
('genre', 'documentary_tv', 'Documentary', 'tv', 'Documentary TV shows', 'genres', ARRAY['Documentary']),
('genre', 'drama_tv', 'Drama', 'tv', 'Drama TV shows', 'genres', ARRAY['Drama']),
('genre', 'family_tv', 'Family', 'tv', 'Family TV shows', 'genres', ARRAY['Family']),
('genre', 'kids', 'Kids', 'tv', 'Kids TV shows', 'genres', ARRAY['Kids']),
('genre', 'mystery_tv', 'Mystery', 'tv', 'Mystery TV shows', 'genres', ARRAY['Mystery']),
('genre', 'news', 'News', 'tv', 'News programs', 'genres', ARRAY['News']),
('genre', 'reality', 'Reality', 'tv', 'Reality TV shows', 'genres', ARRAY['Reality']),
('genre', 'scifi_fantasy', 'Sci-Fi & Fantasy', 'tv', 'Sci-Fi & Fantasy TV shows', 'genres', ARRAY['Sci-Fi & Fantasy']),
('genre', 'soap', 'Soap', 'tv', 'Soap operas', 'genres', ARRAY['Soap']),
('genre', 'talk', 'Talk', 'tv', 'Talk shows', 'genres', ARRAY['Talk']),
('genre', 'war_politics', 'War & Politics', 'tv', 'War & Politics TV shows', 'genres', ARRAY['War & Politics']),
('genre', 'western_tv', 'Western', 'tv', 'Western TV shows', 'genres', ARRAY['Western']);

-- ============================================
-- CONTENT TYPES - BOTH (10)
-- ============================================
INSERT INTO label_presets (category, name, display_name, media_type, description, tmdb_match_field, tmdb_match_values) VALUES
('content_type', 'anime', 'Anime', 'both', 'Japanese animation', 'keywords', ARRAY['anime', 'manga', 'based on manga', 'japanese animation']),
('content_type', 'standup', 'Stand-Up Comedy', 'both', 'Live comedy performances', 'keywords', ARRAY['stand-up comedy', 'comedy special', 'standup']),
('content_type', 'holiday', 'Holiday/Christmas', 'both', 'Seasonal holiday content', 'keywords', ARRAY['christmas', 'holiday', 'santa claus', 'xmas']),
('content_type', 'halloween', 'Halloween', 'both', 'Halloween themed content', 'keywords', ARRAY['halloween', 'trick or treat', 'haunted house']),
('content_type', 'superhero', 'Superhero', 'both', 'Comic book heroes and superheroes', 'keywords', ARRAY['superhero', 'marvel comics', 'dc comics', 'based on comic']),
('content_type', 'true_crime', 'True Crime', 'both', 'Real crime stories and investigations', 'keywords', ARRAY['true crime', 'murder', 'serial killer', 'investigation']),
('content_type', 'sports', 'Sports', 'both', 'Sports focused content', 'keywords', ARRAY['sports', 'football', 'basketball', 'baseball', 'olympics']),
('content_type', 'concert', 'Concert/Music', 'both', 'Live music performances and concerts', 'keywords', ARRAY['concert', 'live performance', 'tour', 'concert film']),
('content_type', 'martial_arts', 'Martial Arts', 'both', 'Fighting and martial arts focused', 'keywords', ARRAY['martial arts', 'kung fu', 'karate', 'mma']),
('content_type', 'adult', 'Adult/Explicit', 'both', 'Explicit adult content', 'keywords', ARRAY['erotic', 'adult film', 'explicit']);

-- ============================================
-- CONTENT TYPES - MOVIE SPECIFIC (5)
-- ============================================
INSERT INTO label_presets (category, name, display_name, media_type, description, tmdb_match_field, tmdb_match_values) VALUES
('content_type', 'hallmark', 'Hallmark/Romance TV Movie', 'movie', 'Hallmark-style romance TV movies', 'keywords', ARRAY['hallmark', 'lifetime movie', 'made for tv']),
('content_type', 'found_footage', 'Found Footage', 'movie', 'Found footage style movies', 'keywords', ARRAY['found footage', 'pov', 'handheld']),
('content_type', 'slasher', 'Slasher', 'movie', 'Slasher horror movies', 'keywords', ARRAY['slasher', 'serial killer', 'masked killer']),
('content_type', 'noir', 'Film Noir', 'movie', 'Film noir style movies', 'keywords', ARRAY['film noir', 'noir', 'neo-noir']),
('content_type', 'b_movie', 'B-Movie/Cult', 'movie', 'B-movies and cult films', 'keywords', ARRAY['b-movie', 'cult film', 'exploitation', 'grindhouse']);

-- ============================================
-- CONTENT TYPES - TV SPECIFIC (12)
-- ============================================
INSERT INTO label_presets (category, name, display_name, media_type, description, tmdb_match_field, tmdb_match_values) VALUES
('content_type', 'late_night', 'Late Night/Talk Show', 'tv', 'Late night and talk shows', 'keywords', ARRAY['talk show', 'late night', 'interview show']),
('content_type', 'game_show', 'Game Show', 'tv', 'Game shows and quiz shows', 'keywords', ARRAY['game show', 'quiz show', 'trivia']),
('content_type', 'reality_competition', 'Reality Competition', 'tv', 'Reality competition shows', 'keywords', ARRAY['reality competition', 'talent show', 'cooking competition']),
('content_type', 'dating_show', 'Dating Show', 'tv', 'Dating and relationship shows', 'keywords', ARRAY['dating show', 'bachelor', 'love island']),
('content_type', 'home_lifestyle', 'Home & Lifestyle', 'tv', 'Home improvement and lifestyle shows', 'keywords', ARRAY['home improvement', 'renovation', 'cooking show']),
('content_type', 'soap_opera', 'Soap Opera', 'tv', 'Soap operas and daytime dramas', 'keywords', ARRAY['soap opera', 'daytime drama', 'telenovela']),
('content_type', 'miniseries', 'Miniseries/Limited', 'tv', 'Miniseries and limited series', 'keywords', ARRAY['miniseries', 'limited series']),
('content_type', 'anthology', 'Anthology', 'tv', 'Anthology series', 'keywords', ARRAY['anthology', 'anthology series']),
('content_type', 'variety', 'Variety Show', 'tv', 'Variety and sketch comedy shows', 'keywords', ARRAY['variety show', 'sketch comedy', 'snl']),
('content_type', 'adult_animation', 'Adult Animation', 'tv', 'Adult animated shows', 'keywords', ARRAY['adult animation', 'adult cartoon', 'animated sitcom']),
('content_type', 'kdrama', 'K-Drama', 'tv', 'Korean dramas', 'keywords', ARRAY['korean drama', 'k-drama', 'kdrama']),
('content_type', 'british', 'British/UK', 'tv', 'British and UK series', 'keywords', ARRAY['british', 'bbc', 'itv', 'uk series']);

-- ============================================
-- LANGUAGES (10)
-- ============================================
INSERT INTO label_presets (category, name, display_name, media_type, description, tmdb_match_field, tmdb_match_values) VALUES
('language', 'english', 'English', 'both', 'English language content', 'original_language', ARRAY['en']),
('language', 'japanese', 'Japanese', 'both', 'Japanese language content', 'original_language', ARRAY['ja']),
('language', 'korean', 'Korean', 'both', 'Korean language content', 'original_language', ARRAY['ko']),
('language', 'spanish', 'Spanish', 'both', 'Spanish language content', 'original_language', ARRAY['es']),
('language', 'french', 'French', 'both', 'French language content', 'original_language', ARRAY['fr']),
('language', 'german', 'German', 'both', 'German language content', 'original_language', ARRAY['de']),
('language', 'italian', 'Italian', 'both', 'Italian language content', 'original_language', ARRAY['it']),
('language', 'chinese', 'Chinese', 'both', 'Chinese language content', 'original_language', ARRAY['zh', 'cn']),
('language', 'hindi', 'Hindi', 'both', 'Hindi language content', 'original_language', ARRAY['hi']),
('language', 'portuguese', 'Portuguese', 'both', 'Portuguese language content', 'original_language', ARRAY['pt']);

-- Default Settings
INSERT INTO settings (key, value) VALUES
('port', '21324'),
('theme', 'dark'),
('app_name', 'Classifarr'),
('version', '1.0.0');

-- Default Ollama Configuration
INSERT INTO ollama_config (host, port, model, temperature, is_active) VALUES
('host.docker.internal', 11434, 'qwen3:14b', 0.30, true);

-- Default Tavily Configuration
INSERT INTO tavily_config (search_depth, max_results, is_active) VALUES
('basic', 5, false);
