/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Migration: Widen AI model identifier columns
 *
 * Provider model identifiers can exceed 100 characters, especially for
 * OpenRouter and custom OpenAI-compatible providers. These fields are
 * identifiers, not bounded display labels, so storing them as TEXT avoids
 * database-level save failures for valid provider-returned model IDs.
 */

DO $$
DECLARE
  model_column record;
BEGIN
  FOR model_column IN
    SELECT *
    FROM (VALUES
      ('ai_provider_config', 'model'),
      ('ai_provider_config', 'ollama_model'),
      ('ai_provider_config', 'embedding_model'),
      ('ai_provider_config', 'embedding_ollama_model'),
      ('ai_provider_config', 'embedding_cloud_model'),
      ('ai_provider_config', 'image_embedding_local_model'),
      ('ai_provider_config', 'image_embedding_cloud_model'),
      ('ai_usage_log', 'model'),
      ('classification_embeddings', 'model'),
      ('ollama_config', 'model')
    ) AS columns_to_widen(table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = model_column.table_name
        AND column_name = model_column.column_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I TYPE TEXT',
        model_column.table_name,
        model_column.column_name
      );
    END IF;
  END LOOP;
END $$;
