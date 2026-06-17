-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- Purpose:
-- The schema snapshot (current.sql) used for fast-path fresh installs was
-- missing idx_embeddings_hnsw (text HNSW index on classification_embeddings).
-- The earlier backfill migration (20260218_150000_backfill_missing_rag_text_hnsw_index.sql)
-- was recorded as applied via the snapshot seeding but never actually ran,
-- leaving the index absent on all installations that used the snapshot path.
-- This migration repairs the gap idempotently for all affected deployments.

DO $$
BEGIN
  IF to_regclass('public.classification_embeddings') IS NULL THEN
    RAISE NOTICE 'Skipping idx_embeddings_hnsw repair: classification_embeddings table not found';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'classification_embeddings'
      AND column_name = 'embedding'
  ) THEN
    RAISE NOTICE 'Skipping idx_embeddings_hnsw repair: embedding column not found';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE NOTICE 'Skipping idx_embeddings_hnsw repair: pgvector extension not installed';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_am WHERE amname = 'hnsw') THEN
    RAISE NOTICE 'Skipping idx_embeddings_hnsw repair: hnsw access method not available';
    RETURN;
  END IF;

  IF to_regclass('public.idx_embeddings_hnsw') IS NULL THEN
    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw
      ON public.classification_embeddings
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    ';
    RAISE NOTICE 'Created idx_embeddings_hnsw (text HNSW index repaired)';
  ELSE
    RAISE NOTICE 'idx_embeddings_hnsw already present, nothing to do';
  END IF;
END $$;
