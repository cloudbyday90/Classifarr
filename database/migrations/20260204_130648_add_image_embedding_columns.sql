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

-- v0.41.x: Add image embedding columns for multimodal RAG

ALTER TABLE classification_embeddings
ADD COLUMN IF NOT EXISTS image_embedding vector(2000);

ALTER TABLE classification_embeddings
ADD COLUMN IF NOT EXISTS image_embedding_dims INTEGER;

ALTER TABLE classification_embeddings
ADD COLUMN IF NOT EXISTS image_provider VARCHAR(50);

ALTER TABLE classification_embeddings
ADD COLUMN IF NOT EXISTS image_model VARCHAR(100);

ALTER TABLE classification_embeddings
ADD COLUMN IF NOT EXISTS image_embedding_hash VARCHAR(64);

ALTER TABLE classification_embeddings
ADD COLUMN IF NOT EXISTS image_embedding_size INTEGER;

ALTER TABLE classification_embeddings
ADD COLUMN IF NOT EXISTS image_embedding_source_url TEXT;

CREATE INDEX IF NOT EXISTS idx_embeddings_image_hnsw
ON classification_embeddings USING hnsw (image_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_embeddings_image_present
ON classification_embeddings (image_provider, image_model)
WHERE image_embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_embeddings_image_hash
ON classification_embeddings (image_embedding_hash, image_model, image_embedding_size)
WHERE image_embedding_hash IS NOT NULL;
