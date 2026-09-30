-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
ALTER TABLE enrichment_retry_queue ADD COLUMN retry_wait_context jsonb,
    ADD COLUMN retry_wait_until timestamptz,
    ADD CONSTRAINT enrichment_retry_wait_context_check CHECK (
        (retry_wait_context IS NULL AND retry_wait_until IS NULL) OR
        (retry_wait_context IS NOT NULL AND retry_wait_until IS NOT NULL
          AND jsonb_typeof(retry_wait_context) = 'array'
          AND jsonb_array_length(retry_wait_context) BETWEEN 1 AND 4
          AND octet_length(retry_wait_context::text) <= 1024));

-- Secret-free current selection; mirrors provider admission including the legacy bridge.
CREATE VIEW enrichment_retry_provider_contexts AS
SELECT 'omdb'::text AS dependency, 'omdb'::text AS provider_key, 'omdb'::text AS source,
    id AS config_id, credential_generation AS generation, credential_rejected_at IS NOT NULL AS credentials_rejected
FROM (SELECT * FROM omdb_config WHERE is_active ORDER BY id DESC LIMIT 1) c WHERE length(btrim(api_key)) > 0
UNION ALL
SELECT 'web_search', provider_key, 'web_search', id, credential_generation, credential_rejected_at IS NOT NULL
FROM web_search_provider_config WHERE is_enabled AND length(btrim(api_key)) > 0 AND provider_key::text IN ('tavily','brave','serper')
UNION ALL
SELECT 'web_search', 'tavily', 'legacy_tavily', id, credential_generation, credential_rejected_at IS NOT NULL
FROM (SELECT * FROM tavily_config WHERE is_active ORDER BY id DESC LIMIT 1) c
WHERE length(btrim(api_key)) > 0 AND NOT EXISTS (SELECT 1 FROM web_search_provider_config WHERE provider_key = 'tavily');
