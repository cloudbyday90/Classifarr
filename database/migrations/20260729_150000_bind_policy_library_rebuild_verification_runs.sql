-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- A rollback snapshot is only usable when it was created from a durable,
-- audited no-difference verification receipt. Keep that immutable evidence
-- separate from the execution gate, but retain its primary key and fingerprint
-- on the gate so later stages can prove what the snapshot consumed.
ALTER TABLE policy_library_rebuild_execution_gates
    ADD COLUMN IF NOT EXISTS verification_run_id BIGINT
        REFERENCES policy_migration_verification_runs(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS verification_run_fingerprint CHAR(64);

ALTER TABLE policy_library_rebuild_execution_gates
    ADD CONSTRAINT policy_library_rebuild_execution_gates_verification_run_pair_chk
    CHECK (
        (verification_run_id IS NULL AND verification_run_fingerprint IS NULL)
        OR (
            verification_run_id IS NOT NULL
            AND verification_run_fingerprint ~ '^[a-f0-9]{64}$'
        )
    );

-- Active pre-binding gates cannot be safely used for a later native
-- replacement because they lack immutable verification provenance. Preserve
-- their existing rollback snapshots for audit/rollback history, but remove
-- their eligibility for the forward path.
UPDATE policy_library_rebuild_execution_gates
SET state = 'invalidated',
    updated_at = NOW()
WHERE state IN ('snapshot_persisting', 'snapshot_persisted')
  AND verification_run_id IS NULL;

ALTER TABLE policy_library_rebuild_execution_gates
    ADD CONSTRAINT policy_library_rebuild_execution_gates_verified_snapshot_chk
    CHECK (
        state NOT IN ('snapshot_persisting', 'snapshot_persisted')
        OR (
            verification_run_id IS NOT NULL
            AND verification_run_fingerprint ~ '^[a-f0-9]{64}$'
        )
    );

CREATE INDEX IF NOT EXISTS idx_policy_library_rebuild_execution_gates_verification_run
    ON policy_library_rebuild_execution_gates (verification_run_id)
    WHERE verification_run_id IS NOT NULL;
