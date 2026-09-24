-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Last locally verified retrieval representation. This is a diagnostic checkpoint,
-- not permission to route; no description, embedding, host or credential is stored.
CREATE TABLE IF NOT EXISTS inventory_description_representation_checkpoint (
    singleton_id smallint PRIMARY KEY DEFAULT 1 CHECK (singleton_id = 1),
    projection_version text NOT NULL CHECK (char_length(projection_version) BETWEEN 1 AND 100),
    config_digest text NOT NULL CHECK (config_digest ~ '^[a-f0-9]{64}$'),
    model_name text NOT NULL CHECK (char_length(model_name) BETWEEN 1 AND 207),
    model_digest text NOT NULL CHECK (model_digest ~ '^[a-f0-9]{64}$'),
    dimensions integer NOT NULL CHECK (dimensions BETWEEN 1 AND 16000),
    verified_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE inventory_description_representation_checkpoint IS
    'Latest local model inspection for read-only description coverage. Stale or mismatched checkpoints are unverified.';
