-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- Purpose:
-- Some upgraded environments can miss idx_embeddings_hnsw even though
-- classification_embeddings exists. Backfill the index idempotently, but only
-- when pgvector and HNSW access method are available.

DO $$
BEGIN
  IF to_regclass('public.classification_embeddings') IS NULL THEN
    RAISE NOTICE 'Skipping idx_embeddings_hnsw backfill: classification_embeddings table not found';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'classification_embeddings'
      AND column_name = 'embedding'
  ) THEN
    RAISE NOTICE 'Skipping idx_embeddings_hnsw backfill: embedding column not found';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE NOTICE 'Skipping idx_embeddings_hnsw backfill: pgvector extension not installed';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_am WHERE amname = 'hnsw') THEN
    RAISE NOTICE 'Skipping idx_embeddings_hnsw backfill: hnsw access method not available';
    RETURN;
  END IF;

  IF to_regclass('public.idx_embeddings_hnsw') IS NULL THEN
    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw
      ON public.classification_embeddings
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    ';
  END IF;
END $$;
