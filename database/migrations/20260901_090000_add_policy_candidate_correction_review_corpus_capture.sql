-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- Future review-corpus capture deliberately persists only the fixed,
-- content-free policy-correction attribution projection. It has no source
-- history ID, media title, external metadata ID, library or destination ID,
-- policy text, model/provider, prompt, response, RAG text, or embedding.

CREATE TABLE IF NOT EXISTS policy_candidate_correction_review_corpus_captures (
    capture_id CHAR(64) PRIMARY KEY,
    capture_version SMALLINT NOT NULL DEFAULT 1,
    purpose_id VARCHAR(96) NOT NULL,
    configuration_revision CHAR(64) NOT NULL,
    score_margin_band_id VARCHAR(16) NOT NULL,
    selection_status_id VARCHAR(40) NOT NULL,
    evidence_source_states JSONB NOT NULL,
    captured_by_actor_id INTEGER NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT pccrc_cap_ver_ck CHECK (
        capture_version = 1
    ),
    CONSTRAINT pccrc_cap_id_ck CHECK (
        capture_id ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT pccrc_cap_purpose_ck CHECK (
        purpose_id = 'representative_historical_correction_review'
    ),
    CONSTRAINT pccrc_cap_rev_ck CHECK (
        configuration_revision ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT pccrc_cap_margin_ck CHECK (
        score_margin_band_id IN ('0_to_4', '5_to_14', '15_to_29', '30_or_more')
    ),
    CONSTRAINT pccrc_cap_selection_ck CHECK (
        selection_status_id IN (
            'confirmed_candidate',
            'changed_to_candidate',
            'changed_outside_candidates',
            'routed_not_applicable'
        )
    ),
    CONSTRAINT pccrc_cap_evidence_ck CHECK (
        jsonb_typeof(evidence_source_states) = 'array'
        AND jsonb_array_length(evidence_source_states) = 5
    ),
    CONSTRAINT pccrc_cap_actor_ck CHECK (
        captured_by_actor_id > 0
    ),
    CONSTRAINT pccrc_cap_expiry_ck CHECK (
        captured_at < expires_at
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_candidate_correction_review_corpus_captures_expiry
    ON policy_candidate_correction_review_corpus_captures (expires_at ASC, capture_id ASC);

CREATE TABLE IF NOT EXISTS policy_candidate_correction_review_corpus_capture_audit_events (
    id BIGSERIAL PRIMARY KEY,
    event_version SMALLINT NOT NULL DEFAULT 1,
    action_id VARCHAR(32) NOT NULL,
    actor_id INTEGER,
    capture_id CHAR(64) NOT NULL,
    capture_recorded_at TIMESTAMPTZ NOT NULL,
    configuration_revision CHAR(64) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pccrc_audit_ver_ck CHECK (
        event_version = 1
    ),
    CONSTRAINT pccrc_audit_action_ck CHECK (
        action_id IN ('capture_recorded', 'capture_expired')
    ),
    CONSTRAINT pccrc_audit_actor_ck CHECK (
        actor_id IS NULL OR actor_id > 0
    ),
    CONSTRAINT pccrc_audit_expiry_actor_ck CHECK (
        (action_id = 'capture_expired' AND actor_id IS NULL)
        OR (action_id = 'capture_recorded' AND actor_id IS NOT NULL)
    ),
    CONSTRAINT pccrc_audit_capture_ck CHECK (
        capture_id ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT pccrc_audit_rev_ck CHECK (
        configuration_revision ~ '^[a-f0-9]{64}$'
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_candidate_correction_review_corpus_capture_audit_events_recent
    ON policy_candidate_correction_review_corpus_capture_audit_events (occurred_at DESC, id DESC);

CREATE OR REPLACE FUNCTION guard_policy_candidate_correction_review_corpus_capture_audit_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Representative review-corpus capture audit events are append-only';
END;
$$;

DROP TRIGGER IF EXISTS policy_candidate_correction_review_corpus_capture_audit_event_mutation_guard
    ON policy_candidate_correction_review_corpus_capture_audit_events;

CREATE TRIGGER policy_candidate_correction_review_corpus_capture_audit_event_mutation_guard
    BEFORE UPDATE OR DELETE ON policy_candidate_correction_review_corpus_capture_audit_events
    FOR EACH ROW
    EXECUTE FUNCTION guard_policy_candidate_correction_review_corpus_capture_audit_event_mutation();
