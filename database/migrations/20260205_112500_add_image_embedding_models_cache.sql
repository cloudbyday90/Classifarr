/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS image_embedding_models_cache JSONB;

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS image_embedding_models_cache_updated_at TIMESTAMPTZ;
