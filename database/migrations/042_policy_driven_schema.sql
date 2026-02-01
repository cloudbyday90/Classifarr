-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

-- v0.37.0: Policy-Driven Classification Engine Schema
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration implements the database schema for the Policy-Driven
-- Classification Engine, replacing rule-centric design with comprehensive
-- policy-based classification with rich content signals, preset support,
-- and prompt feedback learning.
-- 
-- Related Issue: #91
-- Parent Epic: #82 (v0.37.0 Formula-Based Classification Engine)
-- ═══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- 1. CORE POLICY DEFINITION TABLE
-- ============================================================================

-- Library Policies - Core Policy Definition
CREATE TABLE IF NOT EXISTS library_policies (
    id SERIAL PRIMARY KEY,
    library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE,
    
    -- Basic info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    
    -- Ordering (multiple policies per library)
    priority INTEGER DEFAULT 5,
    sort_order INTEGER DEFAULT 0,
    
    -- Classification behavior
    auto_classify_threshold INTEGER DEFAULT 85,
    prompt_threshold INTEGER DEFAULT 60,
    require_ai_validation BOOLEAN DEFAULT true,
    
    -- Trust settings
    trust_patterns BOOLEAN DEFAULT true,
    trust_rag BOOLEAN DEFAULT true,
    trust_history BOOLEAN DEFAULT true,
    
    -- Weight overrides (NULL = use calculated/global)
    preset_weight REAL,
    pattern_weight REAL,
    rag_weight REAL,
    history_weight REAL,
    
    -- Multi-policy behavior
    combination_mode VARCHAR(20) DEFAULT 'best_match',
    
    -- Notifications
    notify_channels JSONB DEFAULT '["app"]',
    
    -- Conflict resolution
    exclusive BOOLEAN DEFAULT false,
    
    -- Source library linking
    source_library_ids JSONB DEFAULT '[]',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_library_policies_library_id ON library_policies(library_id);
CREATE INDEX IF NOT EXISTS idx_library_policies_priority ON library_policies(priority);
CREATE INDEX IF NOT EXISTS idx_library_policies_source ON library_policies USING GIN (source_library_ids);

COMMENT ON TABLE library_policies IS 'Policy-based classification rules for libraries with rich configuration and multi-policy support';
COMMENT ON COLUMN library_policies.auto_classify_threshold IS 'Auto-classify when confidence >= this threshold (0-100)';
COMMENT ON COLUMN library_policies.prompt_threshold IS 'Prompt user when confidence >= this threshold but < auto_classify_threshold';
COMMENT ON COLUMN library_policies.combination_mode IS 'How to combine multiple policies: best_match, weighted_average, consensus';
COMMENT ON COLUMN library_policies.source_library_ids IS 'JSONB array of source library IDs from Plex/Emby/Jellyfin';

-- ============================================================================
-- 2. CONTENT PRESETS - REUSABLE CONTENT SIGNAL DEFINITIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_presets (
    id SERIAL PRIMARY KEY,
    
    key VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    category VARCHAR(50),
    
    -- The signal configuration (JSONB for flexible schema)
    signals JSONB NOT NULL,
    
    -- Ownership
    is_system BOOLEAN DEFAULT true,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT false,
    based_on_preset_id INTEGER REFERENCES content_presets(id),
    
    -- Stats
    usage_count INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_content_presets_category ON content_presets(category);
CREATE INDEX IF NOT EXISTS idx_content_presets_user ON content_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_content_presets_system ON content_presets(is_system);
CREATE INDEX IF NOT EXISTS idx_content_presets_signals ON content_presets USING GIN (signals);

COMMENT ON TABLE content_presets IS 'Reusable content signal definitions for classification (e.g., "Family Friendly", "Action Movies")';
COMMENT ON COLUMN content_presets.signals IS 'JSONB configuration of content signals (genres, keywords, ratings, etc.)';

-- ============================================================================
-- 3. POLICY PRESETS - JUNCTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS policy_presets (
    id SERIAL PRIMARY KEY,
    policy_id INTEGER REFERENCES library_policies(id) ON DELETE CASCADE,
    preset_id INTEGER REFERENCES content_presets(id) ON DELETE CASCADE,
    weight REAL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(policy_id, preset_id)
);

CREATE INDEX IF NOT EXISTS idx_policy_presets_policy_id ON policy_presets(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_presets_preset_id ON policy_presets(preset_id);

COMMENT ON TABLE policy_presets IS 'Links policies to content presets with optional weight adjustments';

-- ============================================================================
-- 4. POLICY OVERRIDES - ADVANCED PER-POLICY TWEAKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS policy_overrides (
    id SERIAL PRIMARY KEY,
    policy_id INTEGER REFERENCES library_policies(id) ON DELETE CASCADE,
    signal_type VARCHAR(50) NOT NULL,
    override_config JSONB NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_overrides_policy_id ON policy_overrides(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_overrides_signal_type ON policy_overrides(signal_type);

COMMENT ON TABLE policy_overrides IS 'Advanced per-policy signal overrides for fine-tuning classification behavior';

-- ============================================================================
-- 5. POLICY FEEDBACK LOG - DECISION CAPTURE
-- ============================================================================

CREATE TABLE IF NOT EXISTS policy_feedback_log (
    id SERIAL PRIMARY KEY,
    
    -- Item identification
    tmdb_id INTEGER NOT NULL,
    media_type VARCHAR(20),
    title VARCHAR(500),
    item_metadata JSONB,
    
    -- Decision context
    prompt_type VARCHAR(30),
    original_scores JSONB,
    top_suggestion_library_id INTEGER,
    top_suggestion_score REAL,
    
    -- User decision
    selected_library_id INTEGER REFERENCES libraries(id),
    selected_policy_id INTEGER REFERENCES library_policies(id),
    was_correction BOOLEAN DEFAULT false,
    user_reason VARCHAR(100),
    user_reason_text TEXT,
    
    -- Patterns
    patterns_created JSONB DEFAULT '[]',
    
    -- Analysis
    signal_analysis JSONB,
    
    -- Timing
    prompted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    response_time_seconds INTEGER,
    source VARCHAR(20) DEFAULT 'web'
);

CREATE INDEX IF NOT EXISTS idx_policy_feedback_tmdb ON policy_feedback_log(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_policy_feedback_library ON policy_feedback_log(selected_library_id);
CREATE INDEX IF NOT EXISTS idx_policy_feedback_policy ON policy_feedback_log(selected_policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_feedback_date ON policy_feedback_log(prompted_at);
CREATE INDEX IF NOT EXISTS idx_policy_feedback_was_correction ON policy_feedback_log(was_correction);

COMMENT ON TABLE policy_feedback_log IS 'Captures user decisions and corrections for policy learning and improvement';
COMMENT ON COLUMN policy_feedback_log.was_correction IS 'True if user corrected an auto-classification decision';

-- ============================================================================
-- 6. POLICY TUNING SUGGESTIONS - AI-GENERATED RECOMMENDATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS policy_tuning_suggestions (
    id SERIAL PRIMARY KEY,
    policy_id INTEGER REFERENCES library_policies(id) ON DELETE CASCADE,
    
    suggestion_type VARCHAR(30) NOT NULL,
    suggestion_config JSONB NOT NULL,
    
    supporting_feedback_ids INTEGER[],
    confidence REAL,
    impact_estimate VARCHAR(100),
    
    status VARCHAR(20) DEFAULT 'pending',
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by INTEGER REFERENCES users(id),
    rejection_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tuning_suggestions_policy ON policy_tuning_suggestions(policy_id);
CREATE INDEX IF NOT EXISTS idx_tuning_suggestions_status ON policy_tuning_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_tuning_suggestions_type ON policy_tuning_suggestions(suggestion_type);

COMMENT ON TABLE policy_tuning_suggestions IS 'AI-generated suggestions for improving policy configuration based on feedback';

-- ============================================================================
-- 7. POLICY LEARNING STATS - AGGREGATE METRICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS policy_learning_stats (
    id SERIAL PRIMARY KEY,
    policy_id INTEGER UNIQUE REFERENCES library_policies(id) ON DELETE CASCADE,
    
    total_decisions INTEGER DEFAULT 0,
    auto_classified INTEGER DEFAULT 0,
    ai_validated INTEGER DEFAULT 0,
    user_prompted INTEGER DEFAULT 0,
    user_corrections INTEGER DEFAULT 0,
    
    accuracy_rate REAL,
    auto_accuracy_rate REAL,
    
    last_7_days_accuracy REAL,
    last_30_days_accuracy REAL,
    trend VARCHAR(20),
    
    last_decision_at TIMESTAMP WITH TIME ZONE,
    last_correction_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_learning_stats_policy ON policy_learning_stats(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_learning_stats_accuracy ON policy_learning_stats(accuracy_rate);

COMMENT ON TABLE policy_learning_stats IS 'Aggregate learning metrics for policy performance tracking and analysis';

-- ============================================================================
-- 8. SOURCE LIBRARY POLICY LINKS - PLEX/EMBY INTEGRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS source_library_policy_links (
    id SERIAL PRIMARY KEY,
    source_library_id VARCHAR(100) NOT NULL,
    source_type VARCHAR(20) NOT NULL,
    source_name VARCHAR(255),
    policy_id INTEGER REFERENCES library_policies(id) ON DELETE CASCADE,
    
    auto_generated BOOLEAN DEFAULT false,
    confidence REAL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(source_library_id, source_type, policy_id)
);

CREATE INDEX IF NOT EXISTS idx_source_library_links_source ON source_library_policy_links(source_library_id, source_type);
CREATE INDEX IF NOT EXISTS idx_source_library_links_policy ON source_library_policy_links(policy_id);

COMMENT ON TABLE source_library_policy_links IS 'Links source media server libraries (Plex/Emby/Jellyfin) to classification policies';

-- ============================================================================
-- 9. POLICY CHANGE LOG - AUDIT TRAIL
-- ============================================================================

CREATE TABLE IF NOT EXISTS policy_change_log (
    id SERIAL PRIMARY KEY,
    policy_id INTEGER REFERENCES library_policies(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL,
    change_config JSONB,
    before_metrics JSONB,
    after_metrics JSONB,
    applied_by INTEGER REFERENCES users(id),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_change_log_policy ON policy_change_log(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_change_log_type ON policy_change_log(change_type);
CREATE INDEX IF NOT EXISTS idx_policy_change_log_date ON policy_change_log(applied_at);

COMMENT ON TABLE policy_change_log IS 'Audit trail of policy configuration changes for tracking and rollback';

-- ============================================================================
-- 10. MODIFY EXISTING TABLES - ADD DEPRECATION SUPPORT
-- ============================================================================

-- Add deprecation columns to library_custom_rules for migration support
ALTER TABLE library_custom_rules 
ADD COLUMN IF NOT EXISTS deprecated BOOLEAN DEFAULT false;

ALTER TABLE library_custom_rules 
ADD COLUMN IF NOT EXISTS migrated_to_policy_id INTEGER REFERENCES library_policies(id);

CREATE INDEX IF NOT EXISTS idx_library_custom_rules_deprecated ON library_custom_rules(deprecated);

COMMENT ON COLUMN library_custom_rules.deprecated IS 'Marks rules that have been migrated to the new policy system';
COMMENT ON COLUMN library_custom_rules.migrated_to_policy_id IS 'References the policy that replaced this rule';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log successful completion
DO $$
BEGIN
    RAISE NOTICE 'Policy-Driven Schema Migration (042) completed successfully';
    RAISE NOTICE 'Created 9 new tables for policy-based classification';
    RAISE NOTICE 'Added deprecation support to library_custom_rules';
END $$;
