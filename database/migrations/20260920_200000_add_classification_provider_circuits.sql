-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE IF NOT EXISTS classification_provider_circuits (
    dependency_key text PRIMARY KEY CHECK (dependency_key ~ '^[a-f0-9]{64}$'),
    epoch bigint NOT NULL DEFAULT 1 CHECK (epoch > 0),
    state text NOT NULL CHECK (state IN ('open', 'half_open', 'closed')),
    trial_remaining smallint NOT NULL DEFAULT 0 CHECK (trial_remaining BETWEEN 0 AND 5),
    ready_until timestamptz,
    last_probe_token uuid,
    failure_code text NOT NULL CHECK (failure_code IN (
        'ai_connection_error', 'ai_timeout', 'ai_rate_limited',
        'ai_server_error', 'ai_gateway_error', 'ai_unavailable'
    )),
    updated_at timestamptz NOT NULL DEFAULT now()
);
