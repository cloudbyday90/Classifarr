-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Explicit administrator work only. No enrollment, identity guessing or retries.
CREATE TABLE queue_identity_repair_previews (
    actor_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    id uuid NOT NULL UNIQUE,
    task_id bigint NOT NULL REFERENCES task_queue(id) ON DELETE CASCADE,
    source_version text NOT NULL CHECK (source_version ~ '^[a-f0-9]{64}$'),
    provider_revision text NOT NULL CHECK (provider_revision ~ '^[a-f0-9]{64}$'),
    candidate jsonb NOT NULL CHECK (jsonb_typeof(candidate) = 'object' AND octet_length(candidate::text) <= 16000),
    sources jsonb NOT NULL CHECK (jsonb_typeof(sources) = 'array'),
    expires_at timestamptz NOT NULL
);
CREATE INDEX idx_queue_identity_repair_preview_task ON queue_identity_repair_previews(task_id);

-- Intentionally no task/user/source FK: retention must not erase repair evidence.
CREATE TABLE queue_identity_repair_receipts (
    task_id bigint PRIMARY KEY CHECK (task_id > 0),
    id uuid NOT NULL UNIQUE,
    actor_id integer NOT NULL CHECK (actor_id > 0),
    source_id bigint,
    source_version text NOT NULL CHECK (source_version ~ '^[a-f0-9]{64}$'),
    provider_revision text NOT NULL CHECK (provider_revision ~ '^[a-f0-9]{64}$'),
    old_tmdb_id integer NOT NULL CHECK (old_tmdb_id > 0),
    repaired_version text NOT NULL CHECK (repaired_version ~ '^[a-f0-9]{64}$'),
    new_tmdb_id integer NOT NULL CHECK (new_tmdb_id > 0 AND new_tmdb_id <> old_tmdb_id),
    media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
    candidate jsonb NOT NULL CHECK (jsonb_typeof(candidate) = 'object' AND octet_length(candidate::text) <= 16000),
    sources jsonb NOT NULL CHECK (jsonb_typeof(sources) = 'array'),
    attempts smallint NOT NULL CHECK (attempts BETWEEN 1 AND 4),
    max_attempts smallint NOT NULL CHECK (max_attempts >= 2 AND max_attempts <= 5 AND max_attempts > attempts),
    confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    retried_at timestamptz,
    retry_actor_id integer,
    CONSTRAINT queue_identity_repair_retry_check CHECK ((retried_at IS NULL) = (retry_actor_id IS NULL))
);
