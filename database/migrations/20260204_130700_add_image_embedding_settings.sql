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

-- v0.41.x: Add image embedding settings (size, rate limits, cache)

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS image_embedding_image_size INTEGER DEFAULT 512;

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS image_embedding_rps INTEGER DEFAULT 2;

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS image_embedding_concurrency INTEGER DEFAULT 2;

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS image_embedding_batch_size INTEGER DEFAULT 1;

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS image_embedding_cache_ttl_hours INTEGER DEFAULT 24;

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS image_embedding_cache_max_mb INTEGER DEFAULT 1024;

ALTER TABLE ai_provider_config
ADD COLUMN IF NOT EXISTS image_embedding_cloud_api_endpoint TEXT;
