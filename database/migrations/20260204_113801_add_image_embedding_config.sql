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

-- v0.41.x: Add image embedding provider configuration
-- Historical note: this migration originally mirrored text/Ollama defaults.
-- 20260425_121000_fix_image_embedding_defaults.sql corrects image embeddings
-- to the current opt-in sidecar defaults: provider_mode='disabled', port=8000.

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS image_embedding_provider_mode VARCHAR(30) DEFAULT 'same';

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS image_embedding_local_host VARCHAR(255);

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS image_embedding_local_port INTEGER DEFAULT 11434;

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS image_embedding_local_model VARCHAR(100);

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS image_embedding_cloud_provider VARCHAR(50);

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS image_embedding_cloud_api_key TEXT;

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS image_embedding_cloud_model VARCHAR(100);
