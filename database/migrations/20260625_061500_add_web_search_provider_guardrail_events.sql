-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- Persist sanitized preview guardrail events so operators can tune guardrail
-- thresholds from aggregate evidence. Search queries, API keys, provider
-- payloads, cache keys, trace IDs, correlation IDs, classification IDs, raw
-- errors, and preview messages are intentionally excluded.

CREATE TABLE IF NOT EXISTS web_search_provider_guardrail_events (
    id BIGSERIAL PRIMARY KEY,
    purpose VARCHAR(60) NOT NULL DEFAULT 'classification',
    guardrail_code VARCHAR(80) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    provider_key VARCHAR(40),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT web_search_provider_guardrail_events_purpose_check
        CHECK (purpose ~ '^[a-z0-9_-]{1,60}$'),
    CONSTRAINT web_search_provider_guardrail_events_code_check
        CHECK (guardrail_code ~ '^[a-z0-9_]{1,80}$'),
    CONSTRAINT web_search_provider_guardrail_events_severity_check
        CHECK (severity IN ('info', 'warning', 'critical')),
    CONSTRAINT web_search_provider_guardrail_events_provider_key_check
        CHECK (provider_key IS NULL OR provider_key ~ '^[a-z0-9_-]{1,40}$')
);

CREATE INDEX IF NOT EXISTS idx_web_search_provider_guardrail_events_created
    ON web_search_provider_guardrail_events (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_web_search_provider_guardrail_events_purpose_time
    ON web_search_provider_guardrail_events (purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_search_provider_guardrail_events_code_time
    ON web_search_provider_guardrail_events (guardrail_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_search_provider_guardrail_events_provider_time
    ON web_search_provider_guardrail_events (provider_key, created_at DESC)
    WHERE provider_key IS NOT NULL;

COMMENT ON TABLE web_search_provider_guardrail_events IS
    'Sanitized calibration preview guardrail events for aggregate web search provider tuning analytics.';
