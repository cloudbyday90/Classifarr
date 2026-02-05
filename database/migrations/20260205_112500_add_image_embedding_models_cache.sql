ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS image_embedding_models_cache JSONB;

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS image_embedding_models_cache_updated_at TIMESTAMPTZ;
