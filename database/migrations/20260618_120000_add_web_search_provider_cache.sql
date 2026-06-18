-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- Provider-neutral web-search response cache.
-- Keeps repeated equivalent provider searches from burning quota while preserving
-- bounded freshness and deterministic cache keys.

CREATE TABLE IF NOT EXISTS web_search_provider_cache (
    cache_key CHAR(64) PRIMARY KEY,
    provider_key VARCHAR(40) NOT NULL,
    purpose VARCHAR(60) NOT NULL,
    query_hash CHAR(64) NOT NULL,
    request_fingerprint CHAR(64) NOT NULL,
    query_preview VARCHAR(160),
    response JSONB NOT NULL,
    result_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_hit_at TIMESTAMPTZ,
    hit_count INTEGER NOT NULL DEFAULT 0,
    source_request_id VARCHAR(160),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT web_search_provider_cache_provider_key_check
        CHECK (provider_key ~ '^[a-z0-9_-]{1,40}$'),
    CONSTRAINT web_search_provider_cache_query_hash_check
        CHECK (query_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT web_search_provider_cache_request_fingerprint_check
        CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
    CONSTRAINT web_search_provider_cache_result_count_check
        CHECK (result_count >= 0 AND result_count <= 20),
    CONSTRAINT web_search_provider_cache_hit_count_check
        CHECK (hit_count >= 0)
);

COMMENT ON TABLE web_search_provider_cache IS
    'Provider-neutral normalized web-search response cache keyed by sanitized request fingerprint.';

CREATE INDEX IF NOT EXISTS idx_web_search_provider_cache_expiry
    ON web_search_provider_cache (expires_at);

CREATE INDEX IF NOT EXISTS idx_web_search_provider_cache_provider_purpose
    ON web_search_provider_cache (provider_key, purpose, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_search_provider_cache_query_hash
    ON web_search_provider_cache (query_hash);
