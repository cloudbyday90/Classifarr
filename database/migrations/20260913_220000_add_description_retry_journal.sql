-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Private retry bookkeeping only. No descriptions, vectors or library membership.
CREATE TABLE IF NOT EXISTS inventory_description_retry_journal (
    projection_version text NOT NULL CHECK (char_length(projection_version) BETWEEN 1 AND 100),
    model_name text NOT NULL CHECK (char_length(model_name) BETWEEN 1 AND 207),
    model_digest text NOT NULL CHECK (model_digest ~ '^[a-f0-9]{64}$'),
    dimensions integer NOT NULL CHECK (dimensions BETWEEN 1 AND 16000),
    description_hash text NOT NULL CHECK (description_hash ~ '^[a-f0-9]{64}$'),
    attempts integer NOT NULL CHECK (attempts BETWEEN 0 AND 7),
    failure_code text NOT NULL CHECK (failure_code IN ('http_rejected','batch','shape','dimensions','nonfinite','float32','zero')),
    next_retry_at timestamptz NOT NULL,
    last_failed_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
    PRIMARY KEY (projection_version, model_name, model_digest, dimensions, description_hash)
);
CREATE INDEX IF NOT EXISTS idx_inventory_description_retry_expiry
    ON inventory_description_retry_journal (expires_at);
COMMENT ON TABLE inventory_description_retry_journal IS
    'Private bounded description retry state. Zero attempts means an unattributed failed batch; only singleton failures increment attempts. No routing authority.';
