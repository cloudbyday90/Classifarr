-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- A runtime admission record proves that an approved manual outcome matched
-- independent destination identity authority. It is not policy intent and may
-- not mutate policy_intents or policy_intent_rules. Like the source-event
-- receipt, this runtime idempotency/audit state is excluded from configuration
-- backups and cleared only by a guarded replace restore.

CREATE TABLE IF NOT EXISTS policy_identity_evidence_admissions (
    id BIGSERIAL PRIMARY KEY,
    admission_version SMALLINT NOT NULL DEFAULT 1,
    source_id VARCHAR(80) NOT NULL,
    source_event_id VARCHAR(160) NOT NULL,
    classification_id BIGINT NOT NULL,
    library_id BIGINT NOT NULL,
    media_type VARCHAR(20) NOT NULL,
    signal_type VARCHAR(50) NOT NULL,
    evidence_key VARCHAR(160) NOT NULL,
    authority_source_id VARCHAR(64) NOT NULL,
    authority_reference VARCHAR(160) NOT NULL,
    authority_policy_id BIGINT,
    authority_intent_id BIGINT,
    authority_intent_version INTEGER,
    authority_fingerprint CHAR(64),
    actor_reference VARCHAR(128),
    source_system VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_identity_evidence_admissions_version_chk CHECK (
        admission_version = 1
    ),
    CONSTRAINT policy_identity_evidence_admissions_source_event_chk CHECK (
        char_length(btrim(source_id)) BETWEEN 1 AND 80
        AND char_length(btrim(source_event_id)) BETWEEN 1 AND 160
    ),
    CONSTRAINT policy_identity_evidence_admissions_identifiers_chk CHECK (
        classification_id > 0
        AND library_id > 0
    ),
    CONSTRAINT policy_identity_evidence_admissions_media_type_chk CHECK (
        media_type IN ('movie', 'tv')
    ),
    CONSTRAINT policy_identity_evidence_admissions_signal_type_chk CHECK (
        signal_type IN ('genres', 'keywords', 'studios', 'media_type')
    ),
    CONSTRAINT policy_identity_evidence_admissions_evidence_key_chk CHECK (
        char_length(btrim(evidence_key)) BETWEEN 3 AND 160
    ),
    CONSTRAINT policy_identity_evidence_admissions_authority_source_chk CHECK (
        authority_source_id IN ('media_server_contents', 'operator_declared_intent')
    ),
    CONSTRAINT policy_identity_evidence_admissions_source_system_chk CHECK (
        source_system = 'policy_authorized_identity_admission'
    ),
    CONSTRAINT policy_identity_evidence_admissions_authority_shape_chk CHECK (
        (
            authority_source_id = 'operator_declared_intent'
            AND authority_policy_id IS NOT NULL
            AND authority_intent_id IS NOT NULL
            AND authority_intent_version IS NOT NULL
            AND authority_intent_version > 0
            AND authority_fingerprint IS NULL
        )
        OR
        (
            authority_source_id = 'media_server_contents'
            AND authority_policy_id IS NULL
            AND authority_intent_id IS NULL
            AND authority_intent_version IS NULL
            AND authority_fingerprint ~ '^[a-f0-9]{64}$'
        )
    ),
    CONSTRAINT policy_identity_evidence_admissions_source_event_unique UNIQUE (
        source_id,
        source_event_id
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_identity_evidence_admissions_library_created
    ON policy_identity_evidence_admissions (library_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION guard_policy_identity_evidence_admission_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE'
       AND current_setting(
           'classifarr.policy_identity_evidence_admission_maintenance',
           true
       ) = 'replace_restore' THEN
        RETURN OLD;
    END IF;

    RAISE EXCEPTION 'Policy identity evidence admissions are append-only';
END;
$$;

DROP TRIGGER IF EXISTS policy_identity_evidence_admission_mutation_guard
    ON policy_identity_evidence_admissions;

CREATE TRIGGER policy_identity_evidence_admission_mutation_guard
    BEFORE UPDATE OR DELETE ON policy_identity_evidence_admissions
    FOR EACH ROW
    EXECUTE FUNCTION guard_policy_identity_evidence_admission_mutation();
