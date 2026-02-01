-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Migration: Convert schema_migrations to support timestamp-based versions
-- Created: 2026-02-01
-- ═══════════════════════════════════════════════════════════════════════════

-- Create new schema_migrations table with VARCHAR version column
CREATE TABLE IF NOT EXISTS schema_migrations_new (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMP DEFAULT NOW(),
  migration_type VARCHAR(50) DEFAULT 'sql',
  description TEXT
);

-- Migrate existing numeric migration records
INSERT INTO schema_migrations_new (filename, applied_at)
SELECT filename, applied_at
FROM schema_migrations
ON CONFLICT (filename) DO NOTHING;

-- Drop old table and rename (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schema_migrations' AND column_name = 'migration_type') THEN
      DROP TABLE schema_migrations;
      ALTER TABLE schema_migrations_new RENAME TO schema_migrations;
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations_new' AND table_schema = 'public') THEN
      ALTER TABLE schema_migrations_new RENAME TO schema_migrations;
    END IF;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied 
  ON schema_migrations(applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_type 
  ON schema_migrations(migration_type);

-- Add table comment
COMMENT ON TABLE schema_migrations IS 
  'Tracks applied database migrations. Supports both legacy numeric (001_name.sql) and timestamp-based (20260201_150000_name.sql) formats.';
