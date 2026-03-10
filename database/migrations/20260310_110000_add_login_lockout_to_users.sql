/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

-- Migration: Add per-account login lockout tracking to users
-- Complements the IP-based rate limiter with per-account protection against
-- credential stuffing via rotating proxies. After MAX_FAILED_LOGINS consecutive
-- failures the account is locked for LOCKOUT_DURATION_MINUTES (both defined in
-- server/src/services/auth.js). The lockout is time-based and self-expiring —
-- no admin intervention required.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

COMMENT ON COLUMN users.failed_login_count IS 'Consecutive failed login attempts since last successful login; reset to 0 on success';
COMMENT ON COLUMN users.locked_until IS 'Account locked until this timestamp due to too many failed login attempts; NULL means not locked';

-- Index so the lockout check (locked_until > NOW()) is fast
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users (locked_until)
  WHERE locked_until IS NOT NULL;
