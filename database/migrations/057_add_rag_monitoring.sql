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
-- 4. EMBEDDING METRICS
-- ============================================================================
-- NOTE: Metrics for embedding_generation operations are already tracked by the
-- existing rag_metrics table (created in migration 039), which includes
-- operation type, duration_ms, success/failure, period_start, and metadata.
-- To avoid duplication and schema confusion, we use the existing rag_metrics
-- table rather than creating a separate embedding_metrics table.
--
-- Query example for embedding metrics:
--   SELECT * FROM rag_metrics WHERE operation = 'embedding_generation'
-- ============================================================================

-- ============================================================================
-- NOTES
-- ============================================================================
-- This migration adds comprehensive monitoring and logging for RAG operations:
--
-- 1. Advanced Configuration: Adds retry, timeout, cache, and debug settings
--    to ai_provider_config for fine-tuning RAG performance
--
-- 2. Activity Logging: Creates rag_logs table for detailed operation tracking
--    with level (info/warning/error) and type (embedding/backfill/provider/cache)
--
-- 3. Error Tracking: Creates embedding_errors table to log and track failed
--    embedding generation attempts with retry counts and resolution status
--
-- 4. Metrics: Uses existing rag_metrics table (from migration 039) for
--    performance metrics. Query with: operation = 'embedding_generation'
--
-- Together with migration 039's rag_metrics table and rag_health_summary view,
-- this provides complete monitoring infrastructure for RAG operations.
-- ============================================================================
-- - Advanced configuration for retry logic, caching, and debugging
-- - Activity logs for tracking all RAG operations
-- - Error tracking for failed embeddings
-- - Metrics aggregation for performance monitoring
