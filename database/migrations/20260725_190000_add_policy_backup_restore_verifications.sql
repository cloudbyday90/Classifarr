/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

-- A successful restore is the only evidence that a backup has been proven
-- recoverable. This append-only installation record intentionally excludes the
-- backup filename, filesystem path, encrypted content, credentials, and policy
-- payloads. A later failed restore is represented by the reconciliation gate,
-- which makes the most recent verification unusable until a new verified
-- restore completes.

CREATE TABLE IF NOT EXISTS policy_backup_restore_verifications (
    id BIGSERIAL PRIMARY KEY,
    verification_version SMALLINT NOT NULL DEFAULT 1,
    restore_mode VARCHAR(16) NOT NULL,
    backup_version VARCHAR(64) NOT NULL,
    verification_status VARCHAR(32) NOT NULL DEFAULT 'verified',
    schema_parity_verified BOOLEAN NOT NULL,
    native_authority_verified BOOLEAN NOT NULL,
    policy_library_mismatch_count INTEGER NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_backup_restore_verifications_version_chk CHECK (
        verification_version = 1
    ),
    CONSTRAINT policy_backup_restore_verifications_mode_chk CHECK (
        restore_mode IN ('replace', 'merge')
    ),
    CONSTRAINT policy_backup_restore_verifications_backup_version_chk CHECK (
        char_length(btrim(backup_version)) BETWEEN 1 AND 64
    ),
    CONSTRAINT policy_backup_restore_verifications_status_chk CHECK (
        verification_status = 'verified'
    ),
    CONSTRAINT policy_backup_restore_verifications_mismatch_count_chk CHECK (
        policy_library_mismatch_count = 0
    ),
    CONSTRAINT policy_backup_restore_verifications_verified_shape_chk CHECK (
        schema_parity_verified = TRUE
        AND native_authority_verified = TRUE
        AND policy_library_mismatch_count = 0
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_backup_restore_verifications_verified
    ON policy_backup_restore_verifications (verified_at DESC, id DESC);

CREATE OR REPLACE FUNCTION guard_policy_backup_restore_verification_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Backup restore verification evidence is append-only';
END;
$$;

DROP TRIGGER IF EXISTS policy_backup_restore_verification_mutation_guard
    ON policy_backup_restore_verifications;

CREATE TRIGGER policy_backup_restore_verification_mutation_guard
    BEFORE UPDATE OR DELETE ON policy_backup_restore_verifications
    FOR EACH ROW
    EXECUTE FUNCTION guard_policy_backup_restore_verification_mutation();
