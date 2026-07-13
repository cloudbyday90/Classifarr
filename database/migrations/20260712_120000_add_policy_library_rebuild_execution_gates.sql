/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

-- Persisted, one-time execution state for an accepted library-derived policy
-- rebuild. This is deliberately separate from native intent data: it records a
-- short-lived authorization and its rollback snapshot without making a rebuild
-- proposal or legacy policy payload a second durable policy model.
CREATE TABLE IF NOT EXISTS policy_library_rebuild_execution_gates (
    id BIGSERIAL PRIMARY KEY,
    policy_id INTEGER NOT NULL REFERENCES library_policies(id) ON DELETE CASCADE,
    intent_id BIGINT NOT NULL REFERENCES policy_intents(id) ON DELETE CASCADE,
    library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    state VARCHAR(40) NOT NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    transition_fingerprint VARCHAR(64) NOT NULL,
    proposal_fingerprint VARCHAR(64) NOT NULL,
    rollback_plan_fingerprint VARCHAR(64) NOT NULL,
    actor_source_id VARCHAR(40) NOT NULL,
    actor_reference VARCHAR(64) NOT NULL,
    acceptance_expires_at TIMESTAMPTZ NOT NULL,
    rollback_snapshot_id BIGINT REFERENCES policy_intent_rollback_snapshots(id) ON DELETE RESTRICT,
    migration_event_id BIGINT REFERENCES policy_intent_migration_events(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_library_rebuild_execution_gates_state_chk CHECK (
        state IN (
            'snapshot_persisting',
            'snapshot_persisted',
            'acceptance_expired',
            'replacement_applied',
            'rollback_applied',
            'invalidated'
        )
    ),
    CONSTRAINT policy_library_rebuild_execution_gates_idempotency_key_chk CHECK (
        idempotency_key ~ '^policy:library_rebuild_acceptance:[a-f0-9]{64}$'
    ),
    CONSTRAINT policy_library_rebuild_execution_gates_transition_fingerprint_chk CHECK (
        transition_fingerprint ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT policy_library_rebuild_execution_gates_proposal_fingerprint_chk CHECK (
        proposal_fingerprint ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT policy_library_rebuild_execution_gates_rollback_plan_fingerprint_chk CHECK (
        rollback_plan_fingerprint ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT policy_library_rebuild_execution_gates_actor_reference_chk CHECK (
        actor_reference ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT policy_library_rebuild_execution_gates_acceptance_window_chk CHECK (
        acceptance_expires_at > created_at
    ),
    CONSTRAINT policy_library_rebuild_execution_gates_persisted_snapshot_chk CHECK (
        state NOT IN ('snapshot_persisted', 'replacement_applied', 'rollback_applied')
        OR (rollback_snapshot_id IS NOT NULL AND migration_event_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_library_rebuild_execution_gates_idempotency
    ON policy_library_rebuild_execution_gates (idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_library_rebuild_execution_gates_transition
    ON policy_library_rebuild_execution_gates (transition_fingerprint);

CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_library_rebuild_execution_gates_active_policy
    ON policy_library_rebuild_execution_gates (policy_id)
    WHERE state IN ('snapshot_persisting', 'snapshot_persisted');

CREATE INDEX IF NOT EXISTS idx_policy_library_rebuild_execution_gates_snapshot
    ON policy_library_rebuild_execution_gates (rollback_snapshot_id)
    WHERE rollback_snapshot_id IS NOT NULL;
