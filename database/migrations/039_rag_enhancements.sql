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

-- v0.35.0: RAG Enhancements
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration implements RAG enhancements including:
--   1. RRF (Reciprocal Rank Fusion) configuration
--   2. Pattern mining infrastructure
--   3. Enhanced error logging for RAG operations
--   4. RAG metrics and health monitoring
-- ═══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- 1. RAG CONFIGURATION ENHANCEMENTS
-- ============================================================================

-- RRF fusion method configuration
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS rag_fusion_method VARCHAR(20) DEFAULT 'rrf';

-- RRF k parameter (smoothing constant, default 60)
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS rag_rrf_k INTEGER DEFAULT 60;

-- Embedding format version for migration tracking
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS embedding_format_version INTEGER DEFAULT 2;

-- ============================================================================
-- 2. PATTERN MINING TABLES
-- ============================================================================

-- Discovered patterns from classification history
CREATE TABLE IF NOT EXISTS discovered_patterns (
    id SERIAL PRIMARY KEY,
    
    -- Pattern type: 'studio', 'franchise', 'genre', 'certification', 'keyword'
    pattern_type VARCHAR(50) NOT NULL,
    
    -- Pattern value (e.g., 'Warner Bros', 'Marvel', 'Action')
    pattern_value TEXT NOT NULL,
    
    -- Target library this pattern suggests
    library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    library_name VARCHAR(255) NOT NULL,
    
    -- Confidence metrics
    confidence NUMERIC(4, 2) NOT NULL DEFAULT 0.00,
    sample_size INTEGER NOT NULL DEFAULT 0,
    support_count INTEGER NOT NULL DEFAULT 0,
    
    -- Pattern status: 'discovered', 'approved', 'rejected', 'decayed'
    status VARCHAR(20) DEFAULT 'discovered',
    
    -- Auto-approval flag
    auto_approved BOOLEAN DEFAULT false,
    
    -- User approval tracking
    approved_by VARCHAR(100),
    approved_at TIMESTAMP,
    rejected_by VARCHAR(100),
    rejected_at TIMESTAMP,
    rejection_reason TEXT,
    
    -- Discovery and decay tracking
    last_seen_at TIMESTAMP DEFAULT NOW(),
    discovered_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Unique constraint per pattern type + value + library
    CONSTRAINT unique_pattern_per_library 
        UNIQUE(pattern_type, pattern_value, library_id)
);

-- Indexes for pattern queries
CREATE INDEX IF NOT EXISTS idx_patterns_type_status ON discovered_patterns(pattern_type, status);
CREATE INDEX IF NOT EXISTS idx_patterns_library ON discovered_patterns(library_id);
CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON discovered_patterns(confidence DESC);

-- Pattern match log for tracking pattern usage
CREATE TABLE IF NOT EXISTS pattern_match_log (
    id SERIAL PRIMARY KEY,
    
    -- Pattern that matched
    pattern_id INTEGER NOT NULL REFERENCES discovered_patterns(id) ON DELETE CASCADE,
    
    -- Classification it matched on
    classification_id INTEGER NOT NULL REFERENCES classification_history(id) ON DELETE CASCADE,
    
    -- Match details
    matched_value TEXT,
    confidence_contribution NUMERIC(4, 2),
    
    -- Whether pattern suggestion was used
    suggestion_used BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pattern_match_pattern ON pattern_match_log(pattern_id);
CREATE INDEX IF NOT EXISTS idx_pattern_match_classification ON pattern_match_log(classification_id);
CREATE INDEX IF NOT EXISTS idx_pattern_match_created ON pattern_match_log(created_at DESC);

-- ============================================================================
-- 3. ENHANCED ERROR LOGGING FOR RAG
-- ============================================================================

-- Add RAG-specific columns to error_log
ALTER TABLE error_log
ADD COLUMN IF NOT EXISTS rag_operation VARCHAR(100);

ALTER TABLE error_log
ADD COLUMN IF NOT EXISTS rag_context JSONB;

ALTER TABLE error_log
ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

ALTER TABLE error_log
ADD COLUMN IF NOT EXISTS recoverable BOOLEAN DEFAULT true;

-- Index for RAG operation queries
CREATE INDEX IF NOT EXISTS idx_error_log_rag_operation ON error_log(rag_operation)
WHERE rag_operation IS NOT NULL;

-- ============================================================================
-- 4. RAG METRICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS rag_metrics (
    id SERIAL PRIMARY KEY,
    
    -- Operation type: 'semantic_search', 'hybrid_search', 'embedding_generation', 'pattern_mining'
    operation VARCHAR(50) NOT NULL,
    
    -- Performance metrics
    duration_ms INTEGER NOT NULL,
    items_processed INTEGER DEFAULT 1,
    
    -- Success/failure tracking
    success BOOLEAN DEFAULT true,
    error_type VARCHAR(100),
    
    -- Additional context
    metadata JSONB,
    
    -- Aggregation fields
    period_type VARCHAR(20) DEFAULT 'hourly',
    period_start TIMESTAMP NOT NULL,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for metrics queries
CREATE INDEX IF NOT EXISTS idx_rag_metrics_operation ON rag_metrics(operation, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_rag_metrics_period ON rag_metrics(period_start DESC);
CREATE INDEX IF NOT EXISTS idx_rag_metrics_success ON rag_metrics(success, operation);

-- ============================================================================
-- 5. RAG HEALTH SUMMARY VIEW
-- ============================================================================

CREATE OR REPLACE VIEW rag_health_summary AS
SELECT
    -- Recent operation counts (last 24 hours)
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as operations_24h,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as operations_1h,
    
    -- Success rates
    COUNT(*) FILTER (WHERE success = true AND created_at >= NOW() - INTERVAL '24 hours') as successful_24h,
    COUNT(*) FILTER (WHERE success = false AND created_at >= NOW() - INTERVAL '24 hours') as failed_24h,
    
    -- Average performance
    AVG(duration_ms) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as avg_duration_ms_24h,
    
    -- By operation type (last 24 hours)
    COUNT(*) FILTER (WHERE operation = 'semantic_search' AND created_at >= NOW() - INTERVAL '24 hours') as semantic_searches_24h,
    COUNT(*) FILTER (WHERE operation = 'hybrid_search' AND created_at >= NOW() - INTERVAL '24 hours') as hybrid_searches_24h,
    COUNT(*) FILTER (WHERE operation = 'embedding_generation' AND created_at >= NOW() - INTERVAL '24 hours') as embeddings_generated_24h,
    COUNT(*) FILTER (WHERE operation = 'pattern_mining' AND created_at >= NOW() - INTERVAL '24 hours') as pattern_mining_runs_24h
FROM rag_metrics;

-- Log the migration
COMMENT ON TABLE discovered_patterns IS 'Automatically discovered classification patterns from history. Used for pattern-based suggestions.';
COMMENT ON TABLE pattern_match_log IS 'Tracking log for pattern matches and usage in classifications.';
COMMENT ON TABLE rag_metrics IS 'Performance metrics for RAG operations (search, embedding, pattern mining).';
COMMENT ON VIEW rag_health_summary IS 'Real-time health dashboard for RAG operations.';
