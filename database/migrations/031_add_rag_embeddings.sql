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

-- v0.34.0: Add RAG (Semantic Search) infrastructure
-- This migration adds pgvector extension and embedding storage tables

-- ============================================================================
-- 1. PGVECTOR EXTENSION
-- ============================================================================
-- Note: pgvector must be installed in PostgreSQL
-- For Docker: postgresql17-contrib includes pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 2. AI PROVIDER CONFIG EXTENSIONS
-- ============================================================================

-- Embedding provider (auto = same as LLM, or explicit: ollama, openai, gemini)
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS embedding_provider VARCHAR(50) DEFAULT 'auto';

-- Embedding model name
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100);

-- RAG enable/disable toggle
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS rag_enabled BOOLEAN DEFAULT false;

-- Similarity threshold (0.0 to 1.0)
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS rag_similarity_threshold NUMERIC(4, 2) DEFAULT 0.70;

-- Backfill budget type: 'percentage' or 'fixed'
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS rag_backfill_budget_type VARCHAR(20) DEFAULT 'percentage';

-- Backfill budget value (% of daily budget or fixed $ amount)
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS rag_backfill_budget_value NUMERIC(10, 2) DEFAULT 25.00;

-- Minimum history count before RAG activates
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS rag_min_history_count INTEGER DEFAULT 50;

-- ============================================================================
-- 3. CLASSIFICATION EMBEDDINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS classification_embeddings (
    id SERIAL PRIMARY KEY,

-- Link to classification history
classification_id INTEGER NOT NULL REFERENCES classification_history (id) ON DELETE CASCADE,

-- The embedding vector (max 2000 for HNSW index)
-- OpenAI small=1536, Gemini=768, Ollama=768
embedding vector (2000) NOT NULL,

-- Metadata
embedding_dims INTEGER NOT NULL,
provider VARCHAR(50) NOT NULL,
model VARCHAR(100) NOT NULL,

-- Staleness tracking (stale when provider changes)
is_stale BOOLEAN DEFAULT false,

-- Timestamps
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW(),

-- One embedding per classification
CONSTRAINT unique_classification_embedding 
        UNIQUE(classification_id)
);

-- HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw ON classification_embeddings USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Index for filtering stale embeddings
CREATE INDEX IF NOT EXISTS idx_embeddings_stale ON classification_embeddings (is_stale)
WHERE
    is_stale = true;

-- Index for provider/model queries
CREATE INDEX IF NOT EXISTS idx_embeddings_provider ON classification_embeddings (provider, model);

-- ============================================================================
-- 4. EMBEDDING COSTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS embedding_costs (
    id SERIAL PRIMARY KEY,

-- Provider info
provider VARCHAR(50) NOT NULL, model VARCHAR(100) NOT NULL,

-- Usage
tokens INTEGER NOT NULL DEFAULT 0,
items_embedded INTEGER NOT NULL DEFAULT 1,

-- Cost in USD
cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,

-- When
created_at TIMESTAMP DEFAULT NOW(),

-- Aggregation
period_type VARCHAR(20) DEFAULT 'daily',
    period_start DATE DEFAULT CURRENT_DATE
);

-- Index for period queries
CREATE INDEX IF NOT EXISTS idx_embedding_costs_period ON embedding_costs (period_start, provider);

-- ============================================================================
-- 5. EMBEDDING RETRY QUEUE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS embedding_retry_queue (
    id SERIAL PRIMARY KEY,

-- Link to classification
classification_id INTEGER NOT NULL REFERENCES classification_history (id) ON DELETE CASCADE,

-- Retry tracking
attempt_count INTEGER DEFAULT 0,
max_attempts INTEGER DEFAULT 5,
last_error TEXT,

-- Scheduling
next_retry_at TIMESTAMP DEFAULT NOW(),

-- Status
status VARCHAR(20) DEFAULT 'pending',

-- Timestamps
created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for retry queue processing
CREATE INDEX IF NOT EXISTS idx_embedding_retry_pending ON embedding_retry_queue (next_retry_at, status)
WHERE
    status = 'pending';

-- ============================================================================
-- 6. FULL-TEXT SEARCH FOR HYBRID SEARCH
-- ============================================================================

-- Add tsvector for hybrid search
ALTER TABLE classification_history
ADD COLUMN IF NOT EXISTS search_text tsvector;

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_classification_search ON classification_history USING GIN (search_text);

-- Trigger to auto-update search_text
CREATE OR REPLACE FUNCTION update_classification_search_text()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_text := to_tsvector('english', 
        COALESCE(NEW.title, '') || ' ' ||
        COALESCE(NEW.library_name, '') || ' ' ||
        COALESCE(NEW.method, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS classification_search_text_trigger ON classification_history;

CREATE TRIGGER classification_search_text_trigger
BEFORE INSERT OR UPDATE ON classification_history
FOR EACH ROW EXECUTE FUNCTION update_classification_search_text();

-- Backfill existing rows
UPDATE classification_history
SET
    search_text = to_tsvector (
        'english',
        COALESCE(title, '') || ' ' || COALESCE(library_name, '') || ' ' || COALESCE(method, '')
    )
WHERE
    search_text IS NULL;