/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

-- This control plane intentionally stores no historical classification,
-- media, destination, AI, RAG, or routing data. It records only the bounded
-- administrator acknowledgement required before a later, separate
-- record-level corpus implementation can be considered.

CREATE TABLE IF NOT EXISTS policy_candidate_correction_review_corpus_controls (
    control_key VARCHAR(64) PRIMARY KEY,
    configuration_version SMALLINT NOT NULL DEFAULT 1,
    purpose_id VARCHAR(96) NOT NULL,
    required_safeguard_ids JSONB NOT NULL,
    review_record_retention_days SMALLINT NOT NULL,
    configuration_revision CHAR(64) NOT NULL,
    acknowledged_by_actor_id INTEGER NOT NULL,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_candidate_correction_review_corpus_controls_key_chk CHECK (
        control_key = 'representative_review_corpus'
    ),
    CONSTRAINT policy_candidate_correction_review_corpus_controls_version_chk CHECK (
        configuration_version = 1
    ),
    CONSTRAINT policy_candidate_correction_review_corpus_controls_purpose_chk CHECK (
        purpose_id = 'representative_historical_correction_review'
    ),
    CONSTRAINT policy_candidate_correction_review_corpus_controls_safeguards_chk CHECK (
        jsonb_typeof(required_safeguard_ids) = 'array'
        AND jsonb_array_length(required_safeguard_ids) = 4
    ),
    CONSTRAINT policy_candidate_correction_review_corpus_controls_retention_chk CHECK (
        review_record_retention_days BETWEEN 7 AND 90
    ),
    CONSTRAINT policy_candidate_correction_review_corpus_controls_revision_chk CHECK (
        configuration_revision ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT policy_candidate_correction_review_corpus_controls_actor_chk CHECK (
        acknowledged_by_actor_id > 0
    )
);

CREATE TABLE IF NOT EXISTS policy_candidate_correction_review_corpus_audit_events (
    id BIGSERIAL PRIMARY KEY,
    event_version SMALLINT NOT NULL DEFAULT 1,
    action_id VARCHAR(64) NOT NULL,
    actor_id INTEGER NOT NULL,
    previous_configuration_revision CHAR(64),
    configuration_revision CHAR(64) NOT NULL,
    purpose_id VARCHAR(96) NOT NULL,
    required_safeguard_ids JSONB NOT NULL,
    review_record_retention_days SMALLINT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_candidate_correction_review_corpus_audit_events_version_chk CHECK (
        event_version = 1
    ),
    CONSTRAINT policy_candidate_correction_review_corpus_audit_events_action_chk CHECK (
        action_id = 'configuration_acknowledged'
    ),
    CONSTRAINT policy_candidate_correction_review_corpus_audit_events_actor_chk CHECK (
        actor_id > 0
    ),
    CONSTRAINT policy_candidate_correction_review_corpus_audit_events_revision_chk CHECK (
        configuration_revision ~ '^[a-f0-9]{64}$'
        AND (
            previous_configuration_revision IS NULL
            OR previous_configuration_revision ~ '^[a-f0-9]{64}$'
        )
    ),
    CONSTRAINT policy_candidate_correction_review_corpus_audit_events_purpose_chk CHECK (
        purpose_id = 'representative_historical_correction_review'
    ),
    CONSTRAINT policy_candidate_correction_review_corpus_audit_events_safeguards_chk CHECK (
        jsonb_typeof(required_safeguard_ids) = 'array'
        AND jsonb_array_length(required_safeguard_ids) = 4
    ),
    CONSTRAINT policy_candidate_correction_review_corpus_audit_events_retention_chk CHECK (
        review_record_retention_days BETWEEN 7 AND 90
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_candidate_correction_review_corpus_audit_events_recent
    ON policy_candidate_correction_review_corpus_audit_events (occurred_at DESC, id DESC);

CREATE OR REPLACE FUNCTION guard_policy_candidate_correction_review_corpus_audit_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Representative review-corpus audit events are append-only';
END;
$$;

DROP TRIGGER IF EXISTS policy_candidate_correction_review_corpus_audit_event_mutation_guard
    ON policy_candidate_correction_review_corpus_audit_events;

CREATE TRIGGER policy_candidate_correction_review_corpus_audit_event_mutation_guard
    BEFORE UPDATE OR DELETE ON policy_candidate_correction_review_corpus_audit_events
    FOR EACH ROW
    EXECUTE FUNCTION guard_policy_candidate_correction_review_corpus_audit_event_mutation();
