-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Private categorical replay evidence; no raw provider responses or media identity.
CREATE TABLE IF NOT EXISTS automatic_evaluation_history (
    result_key text PRIMARY KEY CHECK (result_key ~ '^[a-f0-9]{64}$'),
    observed_at timestamptz NOT NULL CHECK (isfinite(observed_at)),
    last_observed_at timestamptz NOT NULL CHECK (isfinite(last_observed_at) AND last_observed_at >= observed_at),
    result jsonb NOT NULL CHECK (COALESCE((
        jsonb_typeof(result) = 'object' AND result->>'version' = 'evaluation_history.v1'
        AND jsonb_typeof(result->'cases') = 'array'
        AND jsonb_array_length(result->'cases') <= 25
        AND octet_length(result::text) <= 16384
    ), false))
);
CREATE INDEX IF NOT EXISTS automatic_evaluation_history_observed_idx
    ON automatic_evaluation_history (last_observed_at DESC, result_key DESC);
