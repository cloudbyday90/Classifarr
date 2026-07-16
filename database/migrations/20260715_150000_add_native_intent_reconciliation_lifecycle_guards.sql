-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Phase 8R.3.2.4: lifecycle controls prevent automatic reconciliation from
-- undoing a deliberate reversion or writing while a backup restore is still
-- being validated. These tables are operational guards, never an alternate
-- policy model. Keep them limited to stable IDs, references, and timestamps.

CREATE TABLE IF NOT EXISTS policy_native_intent_reconciliation_holds (
    policy_id INTEGER PRIMARY KEY REFERENCES library_policies(id) ON DELETE CASCADE,
    source_event_id BIGINT NOT NULL UNIQUE
        REFERENCES policy_intent_migration_events(id) ON DELETE RESTRICT,
    hold_state VARCHAR(32) NOT NULL DEFAULT 'active',
    reason_id VARCHAR(80) NOT NULL DEFAULT 'rollback_applied',
    held_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ,
    release_reason_id VARCHAR(80),
    released_event_id BIGINT UNIQUE
        REFERENCES policy_intent_migration_events(id) ON DELETE RESTRICT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_native_intent_reconciliation_holds_state_chk CHECK (
        hold_state IN ('active', 'released')
    ),
    CONSTRAINT policy_native_intent_reconciliation_holds_reason_chk CHECK (
        reason_id ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'
    ),
    CONSTRAINT policy_native_intent_reconciliation_holds_release_reason_chk CHECK (
        release_reason_id IS NULL
        OR release_reason_id ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'
    ),
    CONSTRAINT policy_native_intent_reconciliation_holds_release_shape_chk CHECK (
        (
            hold_state = 'active'
            AND released_at IS NULL
            AND release_reason_id IS NULL
            AND released_event_id IS NULL
        )
        OR (
            hold_state = 'released'
            AND released_at IS NOT NULL
            AND release_reason_id IS NOT NULL
            AND released_event_id IS NOT NULL
        )
    ),
    CONSTRAINT policy_native_intent_reconciliation_holds_release_after_hold_chk CHECK (
        released_at IS NULL OR released_at >= held_at
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_native_intent_reconciliation_holds_active
    ON policy_native_intent_reconciliation_holds (policy_id, held_at)
    WHERE hold_state = 'active';

CREATE TABLE IF NOT EXISTS policy_native_intent_reconciliation_restore_gates (
    gate_id SMALLINT PRIMARY KEY DEFAULT 1,
    gate_state VARCHAR(40) NOT NULL,
    reason_id VARCHAR(80) NOT NULL,
    restore_token UUID,
    restore_started_at TIMESTAMPTZ,
    restore_finished_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_native_intent_reconciliation_restore_gates_id_chk CHECK (
        gate_id = 1
    ),
    CONSTRAINT policy_native_intent_reconciliation_restore_gates_state_chk CHECK (
        gate_state IN ('ready', 'restore_in_progress', 'requires_maintenance')
    ),
    CONSTRAINT policy_native_intent_reconciliation_restore_gates_reason_chk CHECK (
        reason_id ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'
    ),
    CONSTRAINT policy_native_intent_reconciliation_restore_gates_in_progress_shape_chk CHECK (
        (
            gate_state = 'restore_in_progress'
            AND restore_token IS NOT NULL
            AND restore_started_at IS NOT NULL
            AND restore_finished_at IS NULL
            AND verified_at IS NULL
        )
        OR gate_state <> 'restore_in_progress'
    ),
    CONSTRAINT policy_native_intent_reconciliation_restore_gates_verified_shape_chk CHECK (
        gate_state <> 'ready'
        OR restore_token IS NULL
        OR (
            restore_started_at IS NOT NULL
            AND restore_finished_at IS NOT NULL
            AND verified_at IS NOT NULL
        )
    ),
    CONSTRAINT policy_native_intent_reconciliation_restore_gates_finish_after_start_chk CHECK (
        restore_finished_at IS NULL
        OR restore_started_at IS NULL
        OR restore_finished_at >= restore_started_at
    )
);

INSERT INTO policy_native_intent_reconciliation_restore_gates (
    gate_id,
    gate_state,
    reason_id
)
VALUES (1, 'ready', 'startup_ready')
ON CONFLICT (gate_id) DO NOTHING;

ALTER TABLE policy_intent_migration_events
    DROP CONSTRAINT IF EXISTS policy_intent_migration_events_event_type_chk;

ALTER TABLE policy_intent_migration_events
    ADD CONSTRAINT policy_intent_migration_events_event_type_chk CHECK (
        event_type IN (
            'dry_run_reported',
            'conversion_started',
            'conversion_applied',
            'conversion_failed',
            'rollback_snapshot_created',
            'rollback_applied',
            'rollback_snapshot_payload_redacted',
            'native_validated',
            'legacy_deletion_ready',
            'library_rebuild_replacement_applied',
            'active_intent_integrity_repaired',
            'reconciliation_reentry_approved'
        )
    );
