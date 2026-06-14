-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Migration: Add provider-neutral web-search provider config and usage storage
-- Purpose: Prepare Tavily, Brave, Serper, and future providers for one storage
--          model while preserving legacy tavily_config behavior.

CREATE TABLE IF NOT EXISTS web_search_provider_config (
    id SERIAL PRIMARY KEY,
    provider_key VARCHAR(40) NOT NULL UNIQUE,
    display_name VARCHAR(120) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    priority INTEGER NOT NULL DEFAULT 100,
    api_key TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    soft_daily_limit INTEGER,
    soft_monthly_limit INTEGER,
    cooldown_until TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_error_at TIMESTAMPTZ,
    last_error_code VARCHAR(80),
    last_error_message TEXT,
    last_error_http_status INTEGER,
    legacy_source VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT web_search_provider_config_provider_key_check
        CHECK (provider_key ~ '^[a-z0-9_-]{1,40}$'),
    CONSTRAINT web_search_provider_config_priority_check
        CHECK (priority >= 0 AND priority <= 1000),
    CONSTRAINT web_search_provider_config_soft_daily_limit_check
        CHECK (soft_daily_limit IS NULL OR soft_daily_limit >= 0),
    CONSTRAINT web_search_provider_config_soft_monthly_limit_check
        CHECK (soft_monthly_limit IS NULL OR soft_monthly_limit >= 0),
    CONSTRAINT web_search_provider_config_last_error_http_status_check
        CHECK (last_error_http_status IS NULL OR (last_error_http_status >= 100 AND last_error_http_status <= 599))
);

CREATE TABLE IF NOT EXISTS web_search_provider_usage (
    id BIGSERIAL PRIMARY KEY,
    provider_key VARCHAR(40) NOT NULL,
    purpose VARCHAR(60) NOT NULL,
    operation VARCHAR(60) NOT NULL DEFAULT 'search',
    status VARCHAR(40) NOT NULL,
    cost_units INTEGER NOT NULL DEFAULT 1,
    result_count INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER,
    searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    correlation_id UUID,
    classification_id BIGINT,
    error_code VARCHAR(80),
    http_status INTEGER,
    retryable BOOLEAN NOT NULL DEFAULT false,
    cooldown_eligible BOOLEAN NOT NULL DEFAULT false,
    retry_after_seconds INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT web_search_provider_usage_provider_key_check
        CHECK (provider_key ~ '^[a-z0-9_-]{1,40}$'),
    CONSTRAINT web_search_provider_usage_status_check
        CHECK (status IN ('success', 'failed', 'skipped', 'rate_limited', 'quota_exhausted')),
    CONSTRAINT web_search_provider_usage_cost_units_check
        CHECK (cost_units >= 0 AND cost_units <= 1000),
    CONSTRAINT web_search_provider_usage_result_count_check
        CHECK (result_count >= 0 AND result_count <= 20),
    CONSTRAINT web_search_provider_usage_duration_ms_check
        CHECK (duration_ms IS NULL OR duration_ms >= 0),
    CONSTRAINT web_search_provider_usage_http_status_check
        CHECK (http_status IS NULL OR (http_status >= 100 AND http_status <= 599)),
    CONSTRAINT web_search_provider_usage_retry_after_seconds_check
        CHECK (retry_after_seconds IS NULL OR retry_after_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS idx_web_search_provider_config_enabled_priority
    ON web_search_provider_config (is_enabled, priority, provider_key);

CREATE INDEX IF NOT EXISTS idx_web_search_provider_config_cooldown
    ON web_search_provider_config (cooldown_until)
    WHERE cooldown_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_web_search_provider_usage_provider_time
    ON web_search_provider_usage (provider_key, searched_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_search_provider_usage_status_time
    ON web_search_provider_usage (status, searched_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_search_provider_usage_correlation
    ON web_search_provider_usage (correlation_id)
    WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_web_search_provider_usage_classification
    ON web_search_provider_usage (classification_id)
    WHERE classification_id IS NOT NULL;

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
ON CONFLICT (provider_key) DO NOTHING;

COMMENT ON TABLE web_search_provider_config IS 'Provider-neutral web-search configuration for Tavily, Brave, Serper, and future search providers.';
COMMENT ON TABLE web_search_provider_usage IS 'Append-only provider-neutral web-search usage and error events for quota-aware routing and observability.';
