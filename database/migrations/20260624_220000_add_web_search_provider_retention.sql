-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- Retain enough provider usage history for current-month quota routing and
-- recent diagnostics, while bounding append-only growth.

INSERT INTO settings (key, value)
VALUES ('web_search_provider_usage_retention_days', '62')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_web_search_provider_usage_searched_at
    ON web_search_provider_usage (searched_at);
