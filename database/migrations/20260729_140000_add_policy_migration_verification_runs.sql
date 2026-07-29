-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Phase 6R.6.4: immutable, bounded verification receipts bridge the
-- server-only representative-classification coordinator to the later rebuild
-- snapshot gate. A receipt deliberately stores digests, status, provenance,
-- counts, and audit summaries only. It never stores representative samples,
-- raw classifications, verifier differences, policy payloads, or browser data.

CREATE TABLE IF NOT EXISTS policy_migration_verification_runs (
    id BIGSERIAL PRIMARY KEY,
    run_version SMALLINT NOT NULL DEFAULT 1,
    policy_id INTEGER NOT NULL REFERENCES library_policies(id) ON DELETE CASCADE,
    intent_id BIGINT NOT NULL REFERENCES policy_intents(id) ON DELETE CASCADE,
    library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    acceptance_transition_fingerprint CHAR(64) NOT NULL,
    source_id VARCHAR(120) NOT NULL,
    source_media_type VARCHAR(20) NOT NULL,
    source_deterministic_order_id VARCHAR(120) NOT NULL,
    source_maximum_classifications SMALLINT NOT NULL,
    source_rows_read INTEGER NOT NULL,
    source_rows_considered INTEGER NOT NULL,
    source_representative_classification_count SMALLINT NOT NULL,
    source_unusable_source_row_count INTEGER NOT NULL,
    source_rows_truncated BOOLEAN NOT NULL,
    source_coverage_sufficient BOOLEAN NOT NULL,
    source_audit_ok BOOLEAN NOT NULL,
    source_audit_issue_count SMALLINT NOT NULL,
    verifier_status_id VARCHAR(120) NOT NULL,
    verifier_fingerprint CHAR(64) NOT NULL,
    verifier_difference_count INTEGER NOT NULL,
    verifier_emitted_difference_count INTEGER NOT NULL,
    verifier_differences_truncated BOOLEAN NOT NULL,
    verifier_audit_ok BOOLEAN NOT NULL,
    verifier_audit_issue_count SMALLINT NOT NULL,
    coordinator_audit_ok BOOLEAN NOT NULL,
    coordinator_audit_issue_count SMALLINT NOT NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    evaluated_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_migration_verification_runs_version_chk CHECK (
        run_version = 1
    ),
    CONSTRAINT policy_migration_verification_runs_policy_context_chk CHECK (
        policy_id > 0 AND intent_id > 0 AND library_id > 0
    ),
    CONSTRAINT policy_migration_verification_runs_transition_fingerprint_chk CHECK (
        acceptance_transition_fingerprint ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT policy_migration_verification_runs_source_chk CHECK (
        source_id = 'persisted_destination_library_final_outcomes'
        AND source_media_type IN ('movie', 'tv')
        AND source_deterministic_order_id = 'created_at_desc_id_desc'
    ),
    CONSTRAINT policy_migration_verification_runs_source_summary_chk CHECK (
        source_maximum_classifications BETWEEN 1 AND 100
        AND source_rows_read >= 0
        AND source_rows_considered >= source_representative_classification_count
        AND source_representative_classification_count BETWEEN 1 AND source_maximum_classifications
        AND source_unusable_source_row_count >= 0
        AND source_coverage_sufficient = TRUE
        AND source_audit_ok = TRUE
        AND source_audit_issue_count = 0
    ),
    CONSTRAINT policy_migration_verification_runs_verifier_chk CHECK (
        verifier_status_id IN (
            'no_migration_differences',
            'review_required',
            'blocked_by_migration_risk'
        )
        AND verifier_fingerprint ~ '^[a-f0-9]{64}$'
        AND verifier_difference_count >= 0
        AND verifier_emitted_difference_count BETWEEN 0 AND verifier_difference_count
        AND verifier_audit_ok = TRUE
        AND verifier_audit_issue_count = 0
    ),
    CONSTRAINT policy_migration_verification_runs_coordinator_audit_chk CHECK (
        coordinator_audit_ok = TRUE
        AND coordinator_audit_issue_count = 0
    ),
    CONSTRAINT policy_migration_verification_runs_idempotency_chk CHECK (
        idempotency_key ~ '^policy:migration_verification:[a-f0-9]{64}$'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_migration_verification_runs_idempotency
    ON policy_migration_verification_runs (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_policy_migration_verification_runs_transition
    ON policy_migration_verification_runs (
        policy_id,
        acceptance_transition_fingerprint,
        created_at DESC,
        id DESC
    );

CREATE INDEX IF NOT EXISTS idx_policy_migration_verification_runs_snapshot_gate
    ON policy_migration_verification_runs (
        policy_id,
        intent_id,
        library_id,
        verifier_status_id,
        created_at DESC,
        id DESC
    );

CREATE OR REPLACE FUNCTION guard_policy_migration_verification_run_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- A replace restore starts a new runtime boundary. Normal runtime paths
    -- must not rewrite or delete migration verification evidence.
    IF TG_OP = 'DELETE'
       AND current_setting(
           'classifarr.policy_migration_verification_run_maintenance',
           true
       ) = 'replace_restore' THEN
        RETURN OLD;
    END IF;

    RAISE EXCEPTION 'Policy migration verification runs are append-only';
END;
$$;

DROP TRIGGER IF EXISTS policy_migration_verification_run_mutation_guard
    ON policy_migration_verification_runs;

CREATE TRIGGER policy_migration_verification_run_mutation_guard
    BEFORE UPDATE OR DELETE ON policy_migration_verification_runs
    FOR EACH ROW
    EXECUTE FUNCTION guard_policy_migration_verification_run_mutation();
