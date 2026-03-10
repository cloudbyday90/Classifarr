/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

-- Migration: Add remember_me to refresh_tokens
-- Tracks whether a session was created with "Remember Me" enabled (30-day cookie lifetime).

ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS remember_me BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN refresh_tokens.remember_me IS 'Whether this session was created with Remember Me enabled (30-day cookie lifetime)';
