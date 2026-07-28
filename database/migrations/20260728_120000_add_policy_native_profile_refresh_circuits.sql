-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Native profile-refresh circuits are operational state, not portable policy
-- configuration. They aggregate terminal outbox failures for one library and
-- one server-derived source revision, preventing a persistent dependency from
-- creating an unbounded recovery chain. Replace restore clears this table with
-- the profile-refresh outbox.

CREATE TABLE IF NOT EXISTS policy_native_profile_refresh_circuits (
    library_id BIGINT NOT NULL,
    source_event_id VARCHAR(160) NOT NULL,
    circuit_state VARCHAR(16) NOT NULL DEFAULT 'closed',
    consecutive_failure_count SMALLINT NOT NULL DEFAULT 0,
    last_terminal_outbox_id BIGINT,
    last_failure_code VARCHAR(80),
    opened_at TIMESTAMPTZ,
    next_probe_at TIMESTAMPTZ,
    probe_outbox_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (library_id, source_event_id),
    CONSTRAINT policy_native_profile_refresh_circuits_library_chk CHECK (
        library_id > 0
    ),
    CONSTRAINT policy_native_profile_refresh_circuits_source_event_chk CHECK (
        char_length(btrim(source_event_id)) BETWEEN 1 AND 160
        AND position(':retry:' IN source_event_id) = 0
    ),
    CONSTRAINT policy_native_profile_refresh_circuits_state_chk CHECK (
        circuit_state IN ('closed', 'open', 'half_open')
    ),
    CONSTRAINT policy_native_profile_refresh_circuits_failure_count_chk CHECK (
        consecutive_failure_count BETWEEN 0 AND 3
    ),
    CONSTRAINT policy_native_profile_refresh_circuits_failure_code_chk CHECK (
        last_failure_code IS NULL
        OR last_failure_code IN (
            'profile_refresh_configuration_invalid',
            'profile_refresh_execution_failed',
            'profile_refresh_lease_expired',
            'profile_refresh_transient_dependency_failed',
            'profile_refresh_unknown_failed'
        )
    ),
    CONSTRAINT policy_native_profile_refresh_circuits_lifecycle_chk CHECK (
        (
            circuit_state = 'closed'
            AND opened_at IS NULL
            AND next_probe_at IS NULL
            AND probe_outbox_id IS NULL
        )
        OR (
            circuit_state = 'open'
            AND opened_at IS NOT NULL
            AND next_probe_at IS NOT NULL
            AND probe_outbox_id IS NULL
        )
        OR (
            circuit_state = 'half_open'
            AND opened_at IS NOT NULL
            AND next_probe_at IS NULL
            AND probe_outbox_id IS NOT NULL
        )
    ),
    CONSTRAINT policy_native_profile_refresh_circuits_empty_state_chk CHECK (
        (consecutive_failure_count = 0 AND last_terminal_outbox_id IS NULL AND last_failure_code IS NULL)
        OR
        (consecutive_failure_count > 0 AND last_terminal_outbox_id IS NOT NULL AND last_failure_code IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_native_profile_refresh_circuits_probe_due
    ON policy_native_profile_refresh_circuits (next_probe_at ASC, library_id ASC)
    WHERE circuit_state = 'open';

CREATE INDEX IF NOT EXISTS idx_policy_native_profile_refresh_circuits_retention
    ON policy_native_profile_refresh_circuits (updated_at ASC, library_id ASC)
    WHERE circuit_state IN ('closed', 'open', 'half_open');
