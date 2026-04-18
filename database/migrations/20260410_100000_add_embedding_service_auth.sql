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

-- Store the sidecar API key as an encrypted value directly in ai_provider_config,
-- consistent with how image_embedding_cloud_api_key is stored for cloud mode.
ALTER TABLE ai_provider_config
  ADD COLUMN IF NOT EXISTS image_embedding_local_api_key TEXT;

-- Add configurable per-request timeout (ms).
-- Default 15000ms matches the current hardcoded value in imageEmbeddingProvider.js.
ALTER TABLE ai_provider_config
  ADD COLUMN IF NOT EXISTS image_embedding_local_timeout_ms INTEGER DEFAULT 15000;
