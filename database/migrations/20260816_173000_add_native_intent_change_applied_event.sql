/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

-- Native intent edits create a new revision and therefore require a durable,
-- queryable audit event. The original writer used values outside this table's
-- constrained vocabulary, which caused the transaction to roll back. Retain
-- all prior event kinds and admit only the explicit change outcome.
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
            'initial_intent_established',
            'native_intent_change_applied'
        )
    );
