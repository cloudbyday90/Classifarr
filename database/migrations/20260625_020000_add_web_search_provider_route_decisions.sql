-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- Persist sanitized web-search provider routing decisions so operators can
-- explain why a provider was selected, skipped, or exhausted after the request
-- has completed. Query text, API keys, provider configs, cache keys, and raw
-- provider responses are intentionally excluded.

CREATE TABLE IF NOT EXISTS web_search_provider_route_decisions (
    id BIGSERIAL PRIMARY KEY,
    route_id UUID NOT NULL UNIQUE,
    purpose VARCHAR(60) NOT NULL DEFAULT 'classification',
    operation VARCHAR(60) NOT NULL DEFAULT 'search',
    outcome VARCHAR(40) NOT NULL,
    selected_provider_key VARCHAR(40),
    final_provider_key VARCHAR(40),
    candidate_count INTEGER NOT NULL DEFAULT 0,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
    attempts JSONB NOT NULL DEFAULT '[]'::jsonb,
    correlation_id VARCHAR(120),
    classification_id BIGINT,
    error_code VARCHAR(80),
    error_http_status INTEGER,
    duration_ms INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT web_search_provider_route_decisions_outcome_check
        CHECK (outcome IN ('success', 'no_provider', 'failed', 'error')),
    CONSTRAINT web_search_provider_route_decisions_selected_provider_key_check
        CHECK (selected_provider_key IS NULL OR selected_provider_key ~ '^[a-z0-9_-]{1,40}$'),
    CONSTRAINT web_search_provider_route_decisions_final_provider_key_check
        CHECK (final_provider_key IS NULL OR final_provider_key ~ '^[a-z0-9_-]{1,40}$'),
    CONSTRAINT web_search_provider_route_decisions_candidate_count_check
        CHECK (candidate_count >= 0 AND candidate_count <= 20),
    CONSTRAINT web_search_provider_route_decisions_attempt_count_check
        CHECK (attempt_count >= 0 AND attempt_count <= 20),
    CONSTRAINT web_search_provider_route_decisions_error_http_status_check
        CHECK (error_http_status IS NULL OR (error_http_status >= 100 AND error_http_status <= 599)),
    CONSTRAINT web_search_provider_route_decisions_duration_ms_check
        CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

CREATE INDEX IF NOT EXISTS idx_web_search_provider_route_decisions_created
    ON web_search_provider_route_decisions (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_web_search_provider_route_decisions_selected_time
    ON web_search_provider_route_decisions (selected_provider_key, created_at DESC)
    WHERE selected_provider_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_web_search_provider_route_decisions_final_time
    ON web_search_provider_route_decisions (final_provider_key, created_at DESC)
    WHERE final_provider_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_web_search_provider_route_decisions_outcome_time
    ON web_search_provider_route_decisions (outcome, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_search_provider_route_decisions_correlation
    ON web_search_provider_route_decisions (correlation_id)
    WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_web_search_provider_route_decisions_classification
    ON web_search_provider_route_decisions (classification_id)
    WHERE classification_id IS NOT NULL;

COMMENT ON TABLE web_search_provider_route_decisions IS 'Sanitized web-search provider routing decisions for operator diagnostics and post-request explainability.';
