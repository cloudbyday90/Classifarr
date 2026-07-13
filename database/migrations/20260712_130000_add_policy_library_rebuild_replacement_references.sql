/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

-- Keep the terminal replacement result attached to the same accepted rebuild
-- execution that produced its rollback snapshot. The references make a retry
-- idempotent without accepting a client-supplied replacement result.
ALTER TABLE policy_library_rebuild_execution_gates
    ADD COLUMN IF NOT EXISTS replacement_intent_id BIGINT
        REFERENCES policy_intents(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS replacement_event_id BIGINT
        REFERENCES policy_intent_migration_events(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS replacement_applied_at TIMESTAMPTZ;

ALTER TABLE policy_library_rebuild_execution_gates
    ADD CONSTRAINT policy_library_rebuild_execution_gates_replacement_applied_chk
    CHECK (
        state <> 'replacement_applied'
        OR (
            replacement_intent_id IS NOT NULL
            AND replacement_event_id IS NOT NULL
            AND replacement_applied_at IS NOT NULL
        )
    ),
    ADD CONSTRAINT policy_library_rebuild_execution_gates_replacement_intent_chk
    CHECK (
        replacement_intent_id IS NULL
        OR replacement_intent_id <> intent_id
    );

CREATE INDEX idx_policy_library_rebuild_execution_gates_replacement_intent
    ON policy_library_rebuild_execution_gates (replacement_intent_id)
    WHERE replacement_intent_id IS NOT NULL;

ALTER TABLE policy_intent_migration_events
    DROP CONSTRAINT policy_intent_migration_events_event_type_chk;

ALTER TABLE policy_intent_migration_events
    ADD CONSTRAINT policy_intent_migration_events_event_type_chk CHECK (
        event_type IN (
            'dry_run_reported',
            'conversion_started',
            'conversion_applied',
            'conversion_failed',
            'rollback_snapshot_created',
            'rollback_applied',
            'native_validated',
            'legacy_deletion_ready',
            'library_rebuild_replacement_applied'
        )
    );
