-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- No historical enrollment or inferred routing authority.
CREATE TABLE IF NOT EXISTS manual_routing_check_state (
    classification_id integer PRIMARY KEY REFERENCES classification_history(id) ON DELETE CASCADE,
    attempt_id text NOT NULL,
    enabled boolean NOT NULL DEFAULT false,
    automatic_attempts smallint NOT NULL DEFAULT 0 CHECK (automatic_attempts BETWEEN 0 AND 3),
    next_check_at timestamptz NOT NULL DEFAULT NOW(),
    last_result varchar(64) NOT NULL DEFAULT 'waiting',
    updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS manual_routing_check_due_idx ON manual_routing_check_state (next_check_at, classification_id)
    WHERE enabled IS TRUE AND automatic_attempts < 3;
