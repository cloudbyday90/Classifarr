-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Lazy, database-scoped correlation only. Never backfill ownership of old warnings.
CREATE TABLE comparison_incident_ledger (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    secret bytea NOT NULL CHECK (octet_length(secret) = 32),
    configuration text NOT NULL CHECK (configuration ~ '^[0-9a-f]{64}$'),
    representation text CHECK (representation ~ '^[0-9a-f]{64}$'),
    scope_id uuid NOT NULL,
    episode_id uuid NOT NULL,
    error_ids uuid[] NOT NULL DEFAULT '{}' CHECK (
        cardinality(error_ids) <= 128 AND array_position(error_ids, NULL) IS NULL)
);
