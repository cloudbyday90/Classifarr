/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

-- Retain a small, server-generated record of the stored library-profile
-- evidence available when a policy first receives native intent. This is
-- provenance only: policy_initial_intent_establishments remains the durable
-- operator-declared authority record, and this table cannot define or change
-- intent, routing, learning, or media actions.

CREATE TABLE IF NOT EXISTS policy_observed_evidence_provenance_snapshots (
    id BIGSERIAL PRIMARY KEY,
    establishment_id BIGINT NOT NULL REFERENCES policy_initial_intent_establishments(id) ON DELETE CASCADE,
    policy_id INTEGER NOT NULL REFERENCES library_policies(id) ON DELETE CASCADE,
    library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    intent_id BIGINT NOT NULL REFERENCES policy_intents(id) ON DELETE CASCADE,
    snapshot_version INTEGER NOT NULL DEFAULT 1,
    source_id VARCHAR(64) NOT NULL,
    capture_state VARCHAR(32) NOT NULL,
    capture_reason_id VARCHAR(64) NOT NULL,
    profile_freshness_state VARCHAR(32) NOT NULL,
    source_profile_generated_at TIMESTAMPTZ,
    source_profile_updated_at TIMESTAMPTZ,
    evidence_fingerprint CHAR(64) NOT NULL,
    snapshot_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    payload_redacted BOOLEAN NOT NULL DEFAULT FALSE,
    redacted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_observed_evidence_provenance_establishment_unique UNIQUE (establishment_id),
    CONSTRAINT policy_observed_evidence_provenance_snapshot_version_chk CHECK (
        snapshot_version = 1
    ),
    CONSTRAINT policy_observed_evidence_provenance_source_chk CHECK (
        source_id = 'stored_library_profile'
    ),
    CONSTRAINT policy_observed_evidence_provenance_capture_state_chk CHECK (
        capture_state IN ('captured', 'profile_unavailable', 'profile_rejected')
    ),
    CONSTRAINT policy_observed_evidence_provenance_capture_reason_chk CHECK (
        capture_reason_id IN (
            'stored_profile_captured',
            'stored_profile_missing',
            'stored_profile_rejected'
        )
    ),
    CONSTRAINT policy_observed_evidence_provenance_capture_pair_chk CHECK (
        (capture_state = 'captured' AND capture_reason_id = 'stored_profile_captured')
        OR (capture_state = 'profile_unavailable' AND capture_reason_id = 'stored_profile_missing')
        OR (capture_state = 'profile_rejected' AND capture_reason_id = 'stored_profile_rejected')
    ),
    CONSTRAINT policy_observed_evidence_provenance_freshness_chk CHECK (
        profile_freshness_state IN ('current', 'stale', 'unavailable')
    ),
    CONSTRAINT policy_observed_evidence_provenance_fingerprint_shape_chk CHECK (
        evidence_fingerprint ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT policy_observed_evidence_provenance_payload_shape_chk CHECK (
        jsonb_typeof(snapshot_payload) = 'object'
        AND octet_length(snapshot_payload::text) <= 16384
    ),
    CONSTRAINT policy_observed_evidence_provenance_redaction_shape_chk CHECK (
        (payload_redacted = FALSE AND redacted_at IS NULL)
        OR (payload_redacted = TRUE AND redacted_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_observed_evidence_provenance_expiry
    ON policy_observed_evidence_provenance_snapshots (expires_at ASC, id ASC)
    WHERE payload_redacted = FALSE;

CREATE INDEX IF NOT EXISTS idx_policy_observed_evidence_provenance_policy
    ON policy_observed_evidence_provenance_snapshots (policy_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION guard_policy_observed_evidence_provenance_snapshot_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.establishment_id IS DISTINCT FROM OLD.establishment_id
       OR NEW.policy_id IS DISTINCT FROM OLD.policy_id
       OR NEW.library_id IS DISTINCT FROM OLD.library_id
       OR NEW.intent_id IS DISTINCT FROM OLD.intent_id
       OR NEW.snapshot_version IS DISTINCT FROM OLD.snapshot_version
       OR NEW.source_id IS DISTINCT FROM OLD.source_id
       OR NEW.capture_state IS DISTINCT FROM OLD.capture_state
       OR NEW.capture_reason_id IS DISTINCT FROM OLD.capture_reason_id
       OR NEW.profile_freshness_state IS DISTINCT FROM OLD.profile_freshness_state
       OR NEW.source_profile_generated_at IS DISTINCT FROM OLD.source_profile_generated_at
       OR NEW.source_profile_updated_at IS DISTINCT FROM OLD.source_profile_updated_at
       OR NEW.evidence_fingerprint IS DISTINCT FROM OLD.evidence_fingerprint
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Observed evidence provenance metadata is immutable';
    END IF;

    IF OLD.payload_redacted = TRUE THEN
        RAISE EXCEPTION 'Observed evidence provenance payload is already redacted';
    END IF;

    IF NEW.payload_redacted IS DISTINCT FROM TRUE
       OR NEW.redacted_at IS NULL
       OR jsonb_typeof(NEW.snapshot_payload) <> 'object'
       OR NOT (NEW.snapshot_payload ? 'retention_marker') THEN
        RAISE EXCEPTION 'Observed evidence provenance snapshots may only transition to a retention marker';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS policy_observed_evidence_provenance_snapshot_update_guard
    ON policy_observed_evidence_provenance_snapshots;

CREATE TRIGGER policy_observed_evidence_provenance_snapshot_update_guard
    BEFORE UPDATE ON policy_observed_evidence_provenance_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION guard_policy_observed_evidence_provenance_snapshot_update();
