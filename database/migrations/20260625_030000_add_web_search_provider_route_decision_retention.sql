-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- @seed-reconciliation snapshot-required
--
-- Keep sanitized provider route decisions long enough for operator diagnosis
-- while bounding append-only diagnostic growth. The route decision table already
-- has an indexed created_at/id path from its creation migration, so this slice
-- only needs the runtime setting seed.

INSERT INTO settings (key, value)
VALUES ('web_search_provider_route_decision_retention_days', '30')
ON CONFLICT (key) DO NOTHING;
