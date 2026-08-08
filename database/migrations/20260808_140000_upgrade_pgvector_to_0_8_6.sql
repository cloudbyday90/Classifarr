-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- Purpose:
-- Upgrade installed pgvector databases to the version compiled into the
-- Classifarr image. The Dockerfile supplies pgvector 0.8.6's complete
-- forward update chain, so PostgreSQL applies the required SQL scripts from
-- the installed version to 0.8.6 within this migration transaction.
--
-- This migration intentionally does not create the extension. Fresh installs
-- create it through the schema snapshot. Existing installations without
-- pgvector keep their current optional-extension posture.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'vector'
  ) THEN
    RAISE NOTICE 'Skipping pgvector upgrade: vector extension is not installed';
    RETURN;
  END IF;

  EXECUTE 'ALTER EXTENSION vector UPDATE TO ''0.8.6''';
END $$;
