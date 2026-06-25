-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- Persist sanitized provider health/cooldown transitions so route diagnostics
-- can explain repeated provider degradation without relying on transient logs.
-- Search queries, API keys, provider configs, cache keys, request fingerprints,
-- and raw provider responses are intentionally excluded.

CREATE TABLE IF NOT EXISTS web_search_provider_health_events (
    id BIGSERIAL PRIMARY KEY,
    provider_key VARCHAR(40) NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    health_status VARCHAR(40) NOT NULL,
    purpose VARCHAR(60) NOT NULL DEFAULT 'classification',
    operation VARCHAR(60) NOT NULL DEFAULT 'search',
    error_code VARCHAR(80),
    error_http_status INTEGER,
    retry_after_seconds INTEGER,
    cooldown_until TIMESTAMPTZ,
    correlation_id VARCHAR(120),
    classification_id BIGINT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT web_search_provider_health_events_provider_key_check
        CHECK (provider_key ~ '^[a-z0-9_-]{1,40}$'),
    CONSTRAINT web_search_provider_health_events_event_type_check
        CHECK (event_type IN ('success', 'error', 'cooldown_started')),
    CONSTRAINT web_search_provider_health_events_health_status_check
        CHECK (health_status IN ('available', 'degraded', 'cooldown')),
    CONSTRAINT web_search_provider_health_events_error_http_status_check
        CHECK (error_http_status IS NULL OR (error_http_status >= 100 AND error_http_status <= 599)),
    CONSTRAINT web_search_provider_health_events_retry_after_check
        CHECK (retry_after_seconds IS NULL OR retry_after_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS idx_web_search_provider_health_events_created
    ON web_search_provider_health_events (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_web_search_provider_health_events_provider_time
    ON web_search_provider_health_events (provider_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_search_provider_health_events_type_time
    ON web_search_provider_health_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_search_provider_health_events_cooldown
    ON web_search_provider_health_events (cooldown_until DESC)
    WHERE cooldown_until IS NOT NULL;

COMMENT ON TABLE web_search_provider_health_events IS 'Sanitized web-search provider health, error, and cooldown events for operator diagnostics.';
