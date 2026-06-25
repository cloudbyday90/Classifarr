-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- @seed-reconciliation snapshot-required
--
-- Reconcile default provider usage retention for fresh installs and upgraded
-- installs. The original retention migration also creates an index, so the
-- schema snapshot generator treats it as schema-bearing and does not splice
-- its INSERT into current.sql. Keep this data-only migration in the seed list
-- so fresh-install snapshots receive the same runtime default as migrations.

INSERT INTO settings (key, value)
VALUES ('web_search_provider_usage_retention_days', '62')
ON CONFLICT (key) DO NOTHING;
