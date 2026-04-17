-- Store the sidecar API key as an encrypted value directly in ai_provider_config,
-- consistent with how image_embedding_cloud_api_key is stored for cloud mode.
ALTER TABLE ai_provider_config
  ADD COLUMN IF NOT EXISTS image_embedding_local_api_key TEXT;

-- Add configurable per-request timeout (ms).
-- Default 15000ms matches the current hardcoded value in imageEmbeddingProvider.js.
ALTER TABLE ai_provider_config
  ADD COLUMN IF NOT EXISTS image_embedding_local_timeout_ms INTEGER DEFAULT 15000;
