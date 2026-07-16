/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

-- First native-intent establishment is not legacy conversion. It requires an
-- explicit operator declaration, one durable idempotency record, and a
-- rollback snapshot. The table has no library-profile, media, prompt, or AI
-- fields, so observed evidence cannot become durable policy authority here.

LOCK TABLE policy_intent_migration_events IN SHARE ROW EXCLUSIVE MODE;

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
            'reconciliation_reentry_approved',
            'semantic_intent_authority_repaired',
            'initial_intent_established'
        )
    );

CREATE TABLE IF NOT EXISTS policy_initial_intent_establishments (
    id BIGSERIAL PRIMARY KEY,
    policy_id INTEGER NOT NULL REFERENCES library_policies(id) ON DELETE CASCADE,
    library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    intent_id BIGINT REFERENCES policy_intents(id) ON DELETE RESTRICT,
    migration_event_id BIGINT REFERENCES policy_intent_migration_events(id) ON DELETE RESTRICT,
    rollback_snapshot_id BIGINT REFERENCES policy_intent_rollback_snapshots(id) ON DELETE RESTRICT,
    idempotency_key VARCHAR(128) NOT NULL,
    request_fingerprint CHAR(64) NOT NULL,
    authority_source_id VARCHAR(50) NOT NULL,
    accepted_by INTEGER NOT NULL,
    state VARCHAR(20) NOT NULL DEFAULT 'pending',
    established_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_initial_intent_establishments_policy_unique UNIQUE (policy_id),
    CONSTRAINT policy_initial_intent_establishments_intent_unique UNIQUE (intent_id),
    CONSTRAINT policy_initial_intent_establishments_event_unique UNIQUE (migration_event_id),
    CONSTRAINT policy_initial_intent_establishments_snapshot_unique UNIQUE (rollback_snapshot_id),
    CONSTRAINT policy_initial_intent_establishments_idempotency_unique UNIQUE (idempotency_key),
    CONSTRAINT policy_initial_intent_establishments_authority_source_chk CHECK (
        authority_source_id = 'operator_declared_intent'
    ),
    CONSTRAINT policy_initial_intent_establishments_idempotency_shape_chk CHECK (
        idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_-]{31,127}$'
    ),
    CONSTRAINT policy_initial_intent_establishments_fingerprint_shape_chk CHECK (
        request_fingerprint ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT policy_initial_intent_establishments_state_chk CHECK (
        state IN ('pending', 'established')
    ),
    CONSTRAINT policy_initial_intent_establishments_state_reference_chk CHECK (
        (state = 'pending'
            AND intent_id IS NULL
            AND migration_event_id IS NULL
            AND rollback_snapshot_id IS NULL
            AND established_at IS NULL)
        OR
        (state = 'established'
            AND intent_id IS NOT NULL
            AND migration_event_id IS NOT NULL
            AND rollback_snapshot_id IS NOT NULL
            AND established_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_initial_intent_establishments_library
    ON policy_initial_intent_establishments (library_id, established_at DESC, id DESC);
