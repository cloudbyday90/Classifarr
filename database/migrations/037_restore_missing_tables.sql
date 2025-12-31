-- v0.35.2: Crisis Restoration - Restore ALL incorrectly dropped tables
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CRITICAL EMERGENCY FIX
-- Migration 034 incorrectly identified several tables as "unused" and dropped them.
-- Codebase verification confirms these tables are CRITICAL for:
--   - Classification Rules (library_rules, library_rules_v2)
--   - Notifications (notification_config)
--   - SSL Settings (ssl_config)
--   - AI Learning (learning_patterns)
--   - Webhooks (media_requests)
--   - Content Analysis (content_analysis_log)
--   - UI Cache (arr_profiles_cache)
--
-- This migration restores ALL of them with their original schemas.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Restore library_rules (Legacy/Compat)
CREATE TABLE IF NOT EXISTS library_rules (
    id SERIAL PRIMARY KEY,
    library_id INTEGER NOT NULL REFERENCES libraries (id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL,
    operator VARCHAR(20) NOT NULL,
    value TEXT NOT NULL,
    is_exception BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_library_rules_library_id ON library_rules (library_id);

CREATE INDEX IF NOT EXISTS idx_library_rules_type ON library_rules (rule_type);

-- 2. Restore library_rules_v2 (Modern Rules)
CREATE TABLE IF NOT EXISTS library_rules_v2 (
    id SERIAL PRIMARY KEY,
    library_id INTEGER NOT NULL REFERENCES libraries (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_library_rules_v2_library_id ON library_rules_v2 (library_id);

CREATE INDEX IF NOT EXISTS idx_library_rules_v2_conditions ON library_rules_v2 USING GIN (conditions);

-- 3. Restore library_custom_rules (Active)
CREATE TABLE IF NOT EXISTS library_custom_rules (
    id SERIAL PRIMARY KEY,
    library_id INTEGER REFERENCES libraries (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_json JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_library_custom_rules_library ON library_custom_rules (library_id);

-- 4. Restore ssl_config (Settings API)
CREATE TABLE IF NOT EXISTS ssl_config (
    id SERIAL PRIMARY KEY,
    enabled BOOLEAN DEFAULT false,
    cert_path VARCHAR(500),
    key_path VARCHAR(500),
    ca_path VARCHAR(500),
    force_https BOOLEAN DEFAULT false,
    hsts_enabled BOOLEAN DEFAULT false,
    hsts_max_age INTEGER DEFAULT 31536000,
    client_cert_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Restore notification_config (Discord Bot)
CREATE TABLE IF NOT EXISTS notification_config (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL DEFAULT 'discord',
    bot_token VARCHAR(500),
    channel_id VARCHAR(100),
    enabled BOOLEAN DEFAULT false,
    notify_on_classification BOOLEAN DEFAULT true,
    notify_on_error BOOLEAN DEFAULT true,
    notify_on_correction BOOLEAN DEFAULT true,
    show_poster BOOLEAN DEFAULT true,
    show_confidence BOOLEAN DEFAULT true,
    show_method BOOLEAN DEFAULT true,
    show_reason BOOLEAN DEFAULT true,
    show_metadata BOOLEAN DEFAULT false,
    enable_corrections BOOLEAN DEFAULT true,
    correction_buttons_count INTEGER DEFAULT 3,
    include_library_dropdown BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (type)
);

-- 6. Restore learning_patterns (AI Feedback)
CREATE TABLE IF NOT EXISTS learning_patterns (
    id SERIAL PRIMARY KEY,
    tmdb_id INTEGER,
    library_id INTEGER REFERENCES libraries (id) ON DELETE CASCADE,
    pattern_type VARCHAR(50),
    pattern_data JSONB,
    confidence DECIMAL(5, 2),
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5, 2) DEFAULT 100.00,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_patterns_tmdb ON learning_patterns (tmdb_id);

CREATE INDEX IF NOT EXISTS idx_learning_patterns_library ON learning_patterns (library_id);

-- 7. Restore media_requests (Webhooks)
CREATE TABLE IF NOT EXISTS media_requests (
    id SERIAL PRIMARY KEY,
    overseerr_request_id INT UNIQUE,
    tmdb_id INT,
    tvdb_id INT,
    media_type VARCHAR(20),
    title VARCHAR(500),
    year INT,
    poster_path VARCHAR(500),
    requested_by_username VARCHAR(255),
    requested_by_email VARCHAR(255),
    requested_by_avatar VARCHAR(500),
    is_4k BOOLEAN DEFAULT false,
    requested_seasons TEXT,
    request_status VARCHAR(50) DEFAULT 'pending',
    classification_id INT REFERENCES classification_history (id),
    routed_to_library_id INT REFERENCES libraries (id),
    routed_to_library_name VARCHAR(255),
    arr_type VARCHAR(20),
    arr_id INT,
    requested_at TIMESTAMP,
    approved_at TIMESTAMP,
    available_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_requests_status ON media_requests (request_status);

CREATE INDEX IF NOT EXISTS idx_media_requests_tmdb ON media_requests (tmdb_id);

-- 8. Restore content_analysis_log (Analysis)
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

-- 9. Restore arr_profiles_cache (UI Dropdowns)
CREATE TABLE IF NOT EXISTS arr_profiles_cache (
    id SERIAL PRIMARY KEY,
    arr_type VARCHAR(10) NOT NULL CHECK (
        arr_type IN ('radarr', 'sonarr')
    ),
    profile_type VARCHAR(50) NOT NULL CHECK (
        profile_type IN (
            'root_folder',
            'quality_profile',
            'tag'
        )
    ),
    profile_id INT NOT NULL,
    profile_name VARCHAR(255),
    profile_path VARCHAR(500),
    profile_data JSONB,
    last_synced TIMESTAMP DEFAULT NOW(),
    UNIQUE (
        arr_type,
        profile_type,
        profile_id
    )
);

CREATE INDEX IF NOT EXISTS idx_arr_profiles_cache_type ON arr_profiles_cache (arr_type, profile_type);

-- 10. Force update trigger for libraries if missing (just in case)
ALTER TABLE libraries
ADD COLUMN IF NOT EXISTS auto_learn BOOLEAN DEFAULT TRUE;

COMMENT ON
TABLE library_rules IS 'Restored critical table in v0.34.3';

COMMENT ON
TABLE library_rules_v2 IS 'Restored critical table in v0.34.3';