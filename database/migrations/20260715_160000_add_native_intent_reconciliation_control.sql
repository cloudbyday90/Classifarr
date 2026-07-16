-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Phase 8R.3.2.5: one durable, server-owned reconciliation control plane.
-- It records only bounded state IDs, timestamps, and an authenticated actor ID
-- for break-glass actions. Never add policy content, provider payloads, SQL
-- errors, stack traces, credentials, or raw exception messages to these rows.

CREATE TABLE IF NOT EXISTS policy_native_intent_reconciliation_controls (
    control_id SMALLINT PRIMARY KEY DEFAULT 1,
    automation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    circuit_state VARCHAR(32) NOT NULL DEFAULT 'closed',
    recovery_requirement VARCHAR(40) NOT NULL DEFAULT 'none',
    failure_count SMALLINT NOT NULL DEFAULT 0,
    failure_window_started_at TIMESTAMPTZ,
    last_failure_category VARCHAR(80),
    opened_at TIMESTAMPTZ,
    recovery_probe_started_at TIMESTAMPTZ,
    recovered_at TIMESTAMPTZ,
    manual_disabled_at TIMESTAMPTZ,
    manual_disabled_reason_id VARCHAR(80),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_native_intent_reconciliation_controls_id_chk CHECK (
        control_id = 1
    ),
    CONSTRAINT policy_native_intent_reconciliation_controls_state_chk CHECK (
        circuit_state IN ('closed', 'open', 'half_open')
    ),
    CONSTRAINT policy_native_intent_reconciliation_controls_recovery_chk CHECK (
        recovery_requirement IN ('none', 'healthy_evaluation', 'admin_reset')
    ),
    CONSTRAINT policy_native_intent_reconciliation_controls_failure_count_chk CHECK (
        failure_count >= 0 AND failure_count <= 3
    ),
    CONSTRAINT policy_native_intent_reconciliation_controls_failure_category_chk CHECK (
        last_failure_category IS NULL
        OR last_failure_category ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'
    ),
    CONSTRAINT policy_native_intent_reconciliation_controls_disabled_reason_chk CHECK (
        manual_disabled_reason_id IS NULL
        OR manual_disabled_reason_id ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'
    ),
    CONSTRAINT policy_native_intent_reconciliation_controls_circuit_shape_chk CHECK (
        (
            circuit_state = 'closed'
            AND recovery_requirement = 'none'
            AND opened_at IS NULL
            AND recovery_probe_started_at IS NULL
        )
        OR (
            circuit_state = 'open'
            AND recovery_requirement IN ('healthy_evaluation', 'admin_reset')
            AND opened_at IS NOT NULL
            AND recovery_probe_started_at IS NULL
        )
        OR (
            circuit_state = 'half_open'
            AND recovery_requirement = 'healthy_evaluation'
            AND opened_at IS NOT NULL
            AND recovery_probe_started_at IS NOT NULL
        )
    ),
    CONSTRAINT policy_native_intent_reconciliation_controls_disabled_shape_chk CHECK (
        (
            automation_enabled = TRUE
            AND manual_disabled_at IS NULL
            AND manual_disabled_reason_id IS NULL
        )
        OR (
            automation_enabled = FALSE
            AND manual_disabled_at IS NOT NULL
            AND manual_disabled_reason_id IS NOT NULL
        )
    )
);

INSERT INTO policy_native_intent_reconciliation_controls (
    control_id,
    automation_enabled,
    circuit_state,
    recovery_requirement
)
VALUES (1, TRUE, 'closed', 'none')
ON CONFLICT (control_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS policy_native_intent_reconciliation_control_events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    reason_id VARCHAR(80) NOT NULL,
    failure_category VARCHAR(80),
    actor_type VARCHAR(24) NOT NULL,
    actor_id INTEGER,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_native_intent_reconciliation_control_events_type_chk CHECK (
        event_type IN (
            'automation_disabled',
            'automation_enabled',
            'circuit_opened',
            'circuit_recovered',
            'circuit_reset'
        )
    ),
    CONSTRAINT policy_native_intent_reconciliation_control_events_reason_chk CHECK (
        reason_id ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'
    ),
    CONSTRAINT policy_native_intent_reconciliation_control_events_failure_category_chk CHECK (
        failure_category IS NULL
        OR failure_category ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'
    ),
    CONSTRAINT policy_native_intent_reconciliation_control_events_actor_type_chk CHECK (
        actor_type IN ('system', 'operator')
    ),
    CONSTRAINT policy_native_intent_reconciliation_control_events_actor_shape_chk CHECK (
        (actor_type = 'system' AND actor_id IS NULL)
        OR (actor_type = 'operator' AND actor_id IS NOT NULL AND actor_id > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_native_intent_reconciliation_control_events_occurred
    ON policy_native_intent_reconciliation_control_events (occurred_at DESC, id DESC);
