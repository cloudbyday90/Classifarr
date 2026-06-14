-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Reconcile provider-neutral web-search seed data that was introduced in a
-- mixed DDL+DML migration. Fresh installs bootstrap from database/schema/current.sql
-- and schema-only dumps omit DML unless it is explicitly replayed.
-- @seed-reconciliation snapshot-required

INSERT INTO web_search_provider_config (
    provider_key,
    display_name,
    is_enabled,
    priority,
    config
)
VALUES
    ('tavily', 'Tavily', false, 10, '{}'::jsonb),
    ('brave', 'Brave Search', false, 20, '{}'::jsonb),
    ('serper', 'Serper.dev', false, 30, '{}'::jsonb)
ON CONFLICT (provider_key) DO UPDATE
SET
    display_name = EXCLUDED.display_name,
    priority = LEAST(web_search_provider_config.priority, EXCLUDED.priority),
    config = CASE
        WHEN web_search_provider_config.config = '{}'::jsonb THEN EXCLUDED.config
        ELSE web_search_provider_config.config
    END,
    updated_at = NOW();

INSERT INTO web_search_provider_config (
    provider_key,
    display_name,
    is_enabled,
    priority,
    api_key,
    config,
    legacy_source,
    updated_at
)
SELECT
    'tavily',
    'Tavily',
    COALESCE(t.is_active, false),
    10,
    NULLIF(t.api_key, ''),
    jsonb_strip_nulls(jsonb_build_object(
        'searchDepth', t.search_depth,
        'maxResults', t.max_results,
        'includeDomains', t.include_domains,
        'excludeDomains', t.exclude_domains
    )),
    'tavily_config',
    NOW()
FROM tavily_config t
ORDER BY t.id DESC
LIMIT 1
ON CONFLICT (provider_key) DO UPDATE
SET
    display_name = EXCLUDED.display_name,
    is_enabled = web_search_provider_config.is_enabled OR EXCLUDED.is_enabled,
    priority = LEAST(web_search_provider_config.priority, EXCLUDED.priority),
    api_key = COALESCE(web_search_provider_config.api_key, EXCLUDED.api_key),
    config = web_search_provider_config.config || EXCLUDED.config,
    legacy_source = COALESCE(web_search_provider_config.legacy_source, EXCLUDED.legacy_source),
    updated_at = NOW();
