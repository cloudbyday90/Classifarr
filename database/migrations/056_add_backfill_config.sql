-- v0.39.0-alpha: Hybrid Backfill System
-- Add configuration for multiple backfill modes (real-time, idle, scheduled, manual)

-- ============================================================================
-- 1. BACKFILL CONFIGURATION COLUMNS
-- ============================================================================

-- Real-time embedding generation
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS realtime_embedding_enabled BOOLEAN DEFAULT true;

-- Idle backfill configuration
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS idle_backfill_enabled BOOLEAN DEFAULT true;

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS idle_threshold INTEGER DEFAULT 30000; -- 30 seconds in ms

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS idle_batch_size INTEGER DEFAULT 10;

-- Scheduled backfill configuration
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS scheduled_backfill_enabled BOOLEAN DEFAULT false;

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS scheduled_backfill_time VARCHAR(10) DEFAULT '02:00';

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS scheduled_backfill_days VARCHAR(20) DEFAULT '0,1,2,3,4,5,6'; -- All days

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS scheduled_backfill_batch_size INTEGER DEFAULT 100;

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS scheduled_backfill_max_duration INTEGER DEFAULT 3600000; -- 1 hour in ms

-- Manual backfill configuration
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS manual_backfill_batch_size INTEGER DEFAULT 50;

-- ============================================================================
-- 2. BACKFILL RUN HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS backfill_runs (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL, -- 'idle' | 'scheduled' | 'manual'
    status VARCHAR(20) NOT NULL, -- 'running' | 'paused' | 'completed' | 'failed'
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    processed INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_backfill_runs_type_status ON backfill_runs(type, status);
CREATE INDEX IF NOT EXISTS idx_backfill_runs_created_at ON backfill_runs(created_at DESC);

-- ============================================================================
-- NOTES
-- ============================================================================
-- This migration adds support for hybrid backfill system:
-- - Real-time: Generate embeddings immediately during classification
-- - Idle: Opportunistic backfill during quiet periods
-- - Scheduled: Large batch processing at configured times
-- - Manual: On-demand backfill with full progress controls
