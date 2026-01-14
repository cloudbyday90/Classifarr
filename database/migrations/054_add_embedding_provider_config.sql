-- v0.39.0-alpha: Embedding Provider Expansion
-- Add support for separate Ollama instances and cloud embedding providers

-- ============================================================================
-- 1. ADD EMBEDDING PROVIDER MODE
-- ============================================================================

-- Provider mode: 'same' (default - same as classification), 'separate_ollama', or 'cloud'
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS embedding_provider_mode VARCHAR(20) DEFAULT 'same';

-- ============================================================================
-- 2. SEPARATE OLLAMA INSTANCE SETTINGS
-- ============================================================================

-- Dedicated Ollama instance for embeddings (different from classification)
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS embedding_ollama_host VARCHAR(255);

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS embedding_ollama_port INTEGER DEFAULT 11434;

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS embedding_ollama_model VARCHAR(100);

-- ============================================================================
-- 3. CLOUD EMBEDDING PROVIDER SETTINGS
-- ============================================================================

-- Cloud provider: 'openai', 'gemini', 'voyage', 'openrouter', 'cohere'
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS embedding_cloud_provider VARCHAR(50);

-- API key for cloud embedding provider (encrypted/masked in responses)
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS embedding_cloud_api_key VARCHAR(500);

-- Model name for cloud embedding provider
ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS embedding_cloud_model VARCHAR(100);

-- ============================================================================
-- NOTES
-- ============================================================================
-- This migration maintains backward compatibility:
-- - Default mode is 'same' which uses existing embedding_provider column
-- - Existing RAG configurations continue to work without changes
-- - New modes provide flexibility for dedicated embedding infrastructure
