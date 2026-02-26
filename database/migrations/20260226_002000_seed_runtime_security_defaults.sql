-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- Migration: Seed runtime security defaults for existing deployments
-- Purpose:
--   Ensure required runtime-security keys exist for upgraded installs
--   without overriding admin-configured values.

INSERT INTO settings (key, value, category, description, is_encrypted)
VALUES
  ('force_secure_cookies', 'false', 'security', 'Force secure cookies (HTTPS-only). Optional for local HTTP deployments.', false),
  ('csrf_protection', 'true', 'security', 'Enable CSRF protection for cookie-authenticated write requests.', false),
  ('cors_origin', '', 'security', 'Comma-separated CORS allowlist. Empty allows all origins.', false)
ON CONFLICT (key) DO NOTHING;
