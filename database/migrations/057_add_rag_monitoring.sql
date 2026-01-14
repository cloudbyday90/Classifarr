-- v0.39.0-alpha: RAG Monitoring and Advanced Configuration
-- Add monitoring tables and advanced configuration for RAG system

-- ============================================================================
-- 1. ADVANCED CONFIGURATION COLUMNS
-- ============================================================================

-- Retry configuration
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS retry_delay INTEGER DEFAULT 1000;

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS request_timeout INTEGER DEFAULT 30000;

-- Caching configuration
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS cache_enabled BOOLEAN DEFAULT false;

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS cache_ttl INTEGER DEFAULT 24;

-- Debug options
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS verbose_logging BOOLEAN DEFAULT false;

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS log_embedding_content BOOLEAN DEFAULT false;

-- ============================================================================
-- 2. RAG ACTIVITY LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS rag_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL, -- 'info' | 'warning' | 'error'
    type VARCHAR(50) NOT NULL, -- 'embedding' | 'backfill' | 'provider' | 'cache'
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient log queries
CREATE INDEX IF NOT EXISTS idx_rag_logs_created_at ON rag_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_logs_level ON rag_logs(level);
CREATE INDEX IF NOT EXISTS idx_rag_logs_type ON rag_logs(type);

-- ============================================================================
-- 3. EMBEDDING ERRORS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS embedding_errors (
    id SERIAL PRIMARY KEY,
    classification_id INTEGER REFERENCES classification_history(id) ON DELETE CASCADE,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    retry_count INTEGER DEFAULT 0,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_embedding_errors_classification ON embedding_errors(classification_id);
CREATE INDEX IF NOT EXISTS idx_embedding_errors_resolved ON embedding_errors(resolved);

-- ============================================================================
-- 4. EMBEDDING METRICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS embedding_metrics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    hour INTEGER NOT NULL,
    generated_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    total_time_ms INTEGER DEFAULT 0,
    cache_hits INTEGER DEFAULT 0,
    UNIQUE(date, hour)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_embedding_metrics_date_hour ON embedding_metrics(date DESC, hour DESC);

-- ============================================================================
-- NOTES
-- ============================================================================
-- This migration adds comprehensive monitoring and logging for RAG operations:
-- - Advanced configuration for retry logic, caching, and debugging
-- - Activity logs for tracking all RAG operations
-- - Error tracking for failed embeddings
-- - Metrics aggregation for performance monitoring
