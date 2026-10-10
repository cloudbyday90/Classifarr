-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE source_catalog_mappings (
    id uuid PRIMARY KEY,
    library_id integer NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    media_server_id integer NOT NULL REFERENCES media_server(id) ON DELETE CASCADE,
    external_id text NOT NULL CHECK (length(external_id) BETWEEN 1 AND 500),
    media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
    provider_fields text[] NOT NULL CHECK (cardinality(provider_fields) <= 3 AND provider_fields <@ ARRAY['tmdb_id','tvdb_id','imdb_id']::text[]),
    source_digest text NOT NULL CHECK (source_digest ~ '^[a-f0-9]{64}$'),
    layout_digest text NOT NULL CHECK (layout_digest ~ '^[a-f0-9]{64}$'),
    configuration_digest text NOT NULL CHECK (configuration_digest ~ '^[a-f0-9]{64}$'),
    evidence_fingerprint text NOT NULL CHECK (evidence_fingerprint ~ '^[a-f0-9]{64}$'),
    scope jsonb NOT NULL CHECK (jsonb_typeof(scope) = 'object' AND octet_length(scope::text) <= 32768),
    documents jsonb NOT NULL CHECK (jsonb_typeof(documents) = 'array' AND jsonb_array_length(documents) <= 32
        AND octet_length(documents::text) <= 262144),
    approved_by integer REFERENCES users(id) ON DELETE SET NULL,
    approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    revoked_at timestamptz,
    materialized_at timestamptz,
    catalog_verified_at timestamptz,
    retry_after timestamptz,
    attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0 AND attempt_count <= 1000000),
    last_outcome text,
    UNIQUE (library_id, media_server_id, external_id)
);
