-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE IF NOT EXISTS media_source_capture_state (
    library_id integer PRIMARY KEY REFERENCES libraries(id) ON DELETE CASCADE,
    media_server_id integer NOT NULL REFERENCES media_server(id) ON DELETE CASCADE,
    generation bigint NOT NULL CHECK (generation > 0),
    mode text NOT NULL CHECK (mode IN ('full', 'incremental')),
    phase text NOT NULL CHECK (phase IN ('collecting', 'complete', 'failed')),
    source text NOT NULL CHECK (source IN ('media_sync', 'local_capture')),
    started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    completed_at timestamptz,
    observed_count integer NOT NULL DEFAULT 0 CHECK (observed_count >= 0),
    rejected_count integer NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
    uncapturable_count integer NOT NULL DEFAULT 0 CHECK (uncapturable_count >= 0),
    omitted_count integer NOT NULL DEFAULT 0 CHECK (omitted_count >= 0),
    UNIQUE (library_id, media_server_id)
);

CREATE TABLE IF NOT EXISTS media_source_observations (
    library_id integer NOT NULL,
    media_server_id integer NOT NULL,
    external_id text NOT NULL CHECK (length(external_id) BETWEEN 1 AND 500),
    title text CHECK (length(title) <= 500),
    year integer CHECK (year BETWEEN 1 AND 9999),
    media_type text CHECK (media_type IN ('movie', 'tv')),
    identity_issue text NOT NULL CHECK (identity_issue IN ('invalid_provider_ids', 'conflicting_provider_ids', 'invalid_media_type')),
    provider_fields text[] NOT NULL DEFAULT '{}' CHECK (provider_fields <@ ARRAY['tmdb_id', 'imdb_id', 'tvdb_id']::text[]),
    first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    generation bigint NOT NULL CHECK (generation > 0),
    PRIMARY KEY (library_id, media_server_id, external_id),
    FOREIGN KEY (library_id, media_server_id) REFERENCES media_source_capture_state(library_id, media_server_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_media_source_observations_recent
    ON media_source_observations(library_id, last_seen_at DESC, external_id);
