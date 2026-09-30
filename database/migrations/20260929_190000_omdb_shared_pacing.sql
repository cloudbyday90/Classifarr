-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Shared automatic-request admission; contains neither API keys nor media metadata.
CREATE TABLE omdb_request_pacing (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    next_admission_at timestamptz NOT NULL,
    blocked_until timestamptz,
    config_id integer CHECK (config_id > 0),
    credential_generation uuid,
    CHECK ((blocked_until IS NULL AND config_id IS NULL AND credential_generation IS NULL)
        OR (blocked_until IS NOT NULL AND config_id IS NOT NULL AND credential_generation IS NOT NULL))
);

-- A bounded hint for resuming the title lookup after an authoritative IMDb miss.
ALTER TABLE enrichment_retry_queue ADD COLUMN omdb_lookup_checkpoint jsonb;
ALTER TABLE enrichment_retry_queue ADD CONSTRAINT omdb_lookup_checkpoint_size
    CHECK (omdb_lookup_checkpoint IS NULL OR
        (jsonb_typeof(omdb_lookup_checkpoint) = 'object' AND octet_length(omdb_lookup_checkpoint::text) <= 1024));
