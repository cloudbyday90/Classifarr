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

-- v0.39.3-alpha: Fix embedding vector dimensions
-- This migration addresses the "column does not have dimensions" error
-- by resizing the vector column to match the configured embedding model.
--
-- Background:
-- - Migration 031 created vector(2000) which is larger than any model needs
-- - Different models have different dimensions: nomic-embed-text (768), mxbai-embed-large (1024), etc.
-- - pgvector requires exact dimension match, causing "expected X dimensions, not Y" errors
-- - v0.39.2c-alpha added auto-healing, but this migration proactively fixes the schema

-- ============================================================================
-- APPROACH: Dynamic dimension detection
-- ============================================================================
-- We cannot use variables in DDL directly, so we use a function approach

DO $$
DECLARE
    target_dims INTEGER;
    current_model VARCHAR(100);
    current_mode VARCHAR(50);
    has_embeddings INTEGER;
    current_column_dims INTEGER;
BEGIN
    -- Get the configured embedding model and mode
    SELECT 
        COALESCE(embedding_model, 'nomic-embed-text'),
        COALESCE(embedding_provider_mode, 'same')
    INTO current_model, current_mode
    FROM ai_provider_config 
    WHERE id = 1;

    -- Map model to dimensions (default 768 if unknown)
    CASE 
        -- Ollama models
        WHEN current_model LIKE '%nomic-embed-text%' THEN target_dims := 768;
        WHEN current_model LIKE '%mxbai-embed-large%' THEN target_dims := 1024;
        WHEN current_model LIKE '%snowflake-arctic-embed%' THEN target_dims := 1024;
        WHEN current_model LIKE '%bge-m3%' THEN target_dims := 1024;
        WHEN current_model LIKE '%bge-large%' THEN target_dims := 1024;
        WHEN current_model LIKE '%all-minilm%' THEN target_dims := 384;
        WHEN current_model LIKE '%paraphrase-multilingual%' THEN target_dims := 768;
        
        -- OpenAI models
        WHEN current_model = 'text-embedding-3-small' THEN target_dims := 1536;
        WHEN current_model = 'text-embedding-3-large' THEN target_dims := 3072;
        WHEN current_model = 'text-embedding-ada-002' THEN target_dims := 1536;
        
        -- Gemini models
        WHEN current_model LIKE '%text-embedding-004%' THEN target_dims := 768;
        WHEN current_model LIKE '%embedding-001%' THEN target_dims := 768;
        
        -- Voyage models
        WHEN current_model LIKE '%voyage-2%' AND NOT current_model LIKE '%large%' THEN target_dims := 1024;
        WHEN current_model LIKE '%voyage-large%' THEN target_dims := 1536;
        WHEN current_model LIKE '%voyage-code%' THEN target_dims := 1536;
        
        -- Cohere models
        WHEN current_model LIKE '%embed-english-v3%' AND NOT current_model LIKE '%light%' THEN target_dims := 1024;
        WHEN current_model LIKE '%embed-multilingual-v3%' THEN target_dims := 1024;
        WHEN current_model LIKE '%embed-english-light%' THEN target_dims := 384;
        
        -- Default for unknown models (most common dimension)
        ELSE target_dims := 768;
    END CASE;

    -- Check if we have existing embeddings
    SELECT COUNT(*) INTO has_embeddings FROM classification_embeddings;

    -- Get current column dimensions by inspecting the actual column type in pg_catalog
    -- For pgvector, the dimension is stored in atttypmod and computed as (atttypmod - 4)
    SELECT
        CASE
            WHEN att.atttypid = 'vector'::regtype AND att.atttypmod > 0 THEN
                att.atttypmod - 4
            ELSE 2000  -- Default from migration 031 if we can't determine it
        END
    INTO current_column_dims
    FROM pg_attribute att
    WHERE att.attrelid = 'classification_embeddings'::regclass
      AND att.attname = 'embedding'
      AND NOT att.attisdropped;

    -- If we can't determine current dims, assume it's 2000 (the original)
    IF current_column_dims IS NULL THEN
        current_column_dims := 2000;
    END IF;

    RAISE NOTICE 'Current model: %, Target dimensions: %, Has embeddings: %, Current column dims: %', 
        current_model, target_dims, has_embeddings, current_column_dims;

    -- Only alter if dimensions don't match
    IF current_column_dims != target_dims THEN
        -- If we have embeddings, we must clear them (incompatible dimensions)
        IF has_embeddings > 0 THEN
            RAISE NOTICE 'Clearing % existing embeddings due to dimension change (% -> %)', 
                has_embeddings, current_column_dims, target_dims;
            TRUNCATE TABLE classification_embeddings;
        END IF;

        -- Alter the column to the correct dimension
        RAISE NOTICE 'Resizing embedding column from vector(%) to vector(%)', current_column_dims, target_dims;
        EXECUTE format('ALTER TABLE classification_embeddings ALTER COLUMN embedding TYPE vector(%s)', target_dims);
        
        RAISE NOTICE 'Migration complete: embedding column is now vector(%). Embeddings will be regenerated on next classification.', target_dims;
    ELSE
        RAISE NOTICE 'Column dimensions already correct (vector(%)). No changes needed.', target_dims;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to resize embedding column: %. Skipping migration - auto-healing will handle on next embedding generation.', SQLERRM;
        -- Don't fail the entire migration - auto-healing will catch this later
END $$;

-- ============================================================================
-- ADD HELPFUL COMMENT
-- ============================================================================
COMMENT ON COLUMN classification_embeddings.embedding IS 
    'Vector embedding (dimensions match configured model: nomic-embed-text=768, mxbai-embed-large=1024, text-embedding-3-small=1536, etc.)';
