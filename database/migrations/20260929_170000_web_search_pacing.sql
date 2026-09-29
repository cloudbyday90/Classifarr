-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE web_search_provider_pacing (
    provider_key VARCHAR(40) PRIMARY KEY CHECK (provider_key IN ('tavily', 'brave', 'serper')),
    next_admission_at TIMESTAMPTZ NOT NULL,
    blocked_until TIMESTAMPTZ,
    source TEXT CHECK (source IN ('web_search', 'legacy_tavily')),
    config_id INTEGER CHECK (config_id > 0),
    credential_generation UUID,
    CHECK (source IS DISTINCT FROM 'legacy_tavily' OR provider_key = 'tavily'),
    CHECK ((blocked_until IS NULL AND source IS NULL AND config_id IS NULL AND credential_generation IS NULL)
        OR (blocked_until IS NOT NULL AND source IS NOT NULL AND config_id IS NOT NULL AND credential_generation IS NOT NULL))
);
COMMENT ON TABLE web_search_provider_pacing IS 'Bounded automatic web-provider timing; generation-scoped delays contain no credentials or raw headers.';
