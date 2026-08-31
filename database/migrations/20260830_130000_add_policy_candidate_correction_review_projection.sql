/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

-- A representative-review projection contains only fixed, non-identifying
-- correction-attribution categories. It deliberately has no history row ID,
-- title, TMDB ID, year, library, destination, prompt, response, provider,
-- RAG, or raw metadata column. Source history is consumed only inside the
-- server-side sampling INSERT and is never retained by this schema.

CREATE TABLE IF NOT EXISTS policy_candidate_correction_review_projections (
    snapshot_id CHAR(64) PRIMARY KEY,
    projection_version SMALLINT NOT NULL DEFAULT 1,
    purpose_id VARCHAR(96) NOT NULL,
    configuration_revision CHAR(64) NOT NULL,
    previous_window_start_at TIMESTAMPTZ NOT NULL,
    previous_window_end_at TIMESTAMPTZ NOT NULL,
    current_window_start_at TIMESTAMPTZ NOT NULL,
    current_window_end_at TIMESTAMPTZ NOT NULL,
    sample_per_stratum SMALLINT NOT NULL DEFAULT 5,
    item_count SMALLINT NOT NULL DEFAULT 0,
    created_by_actor_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT policy_candidate_correction_review_projections_version_chk CHECK (
        projection_version = 1
    ),
    CONSTRAINT policy_candidate_correction_review_projections_snapshot_id_chk CHECK (
        snapshot_id ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT policy_candidate_correction_review_projections_purpose_chk CHECK (
        purpose_id = 'representative_historical_correction_review'
    ),
    CONSTRAINT policy_candidate_correction_review_projections_revision_chk CHECK (
        configuration_revision ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT policy_candidate_correction_review_projections_windows_chk CHECK (
        previous_window_start_at < previous_window_end_at
        AND previous_window_end_at = current_window_start_at
        AND current_window_start_at < current_window_end_at
    ),
    CONSTRAINT policy_candidate_correction_review_projections_sample_chk CHECK (
        sample_per_stratum BETWEEN 1 AND 5
    ),
    CONSTRAINT policy_candidate_correction_review_projections_item_count_chk CHECK (
        item_count BETWEEN 0 AND 160
    ),
    CONSTRAINT policy_candidate_correction_review_projections_actor_chk CHECK (
        created_by_actor_id > 0
    ),
    CONSTRAINT policy_candidate_correction_review_projections_expiry_chk CHECK (
        created_at < expires_at
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_candidate_correction_review_projections_active
    ON policy_candidate_correction_review_projections (configuration_revision, expires_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS policy_candidate_correction_review_projection_items (
    snapshot_id CHAR(64) NOT NULL REFERENCES policy_candidate_correction_review_projections(snapshot_id) ON DELETE CASCADE,
    ordinal SMALLINT NOT NULL,
    period_id VARCHAR(16) NOT NULL,
    score_margin_band_id VARCHAR(16) NOT NULL,
    selection_status_id VARCHAR(40) NOT NULL,
    evidence_source_states JSONB NOT NULL,
    PRIMARY KEY (snapshot_id, ordinal),
    CONSTRAINT policy_candidate_correction_review_projection_items_ordinal_chk CHECK (
        ordinal BETWEEN 1 AND 160
    ),
    CONSTRAINT policy_candidate_correction_review_projection_items_period_chk CHECK (
        period_id IN ('previous', 'current')
    ),
    CONSTRAINT policy_candidate_correction_review_projection_items_margin_chk CHECK (
        score_margin_band_id IN ('0_to_4', '5_to_14', '15_to_29', '30_or_more')
    ),
    CONSTRAINT policy_candidate_correction_review_projection_items_selection_chk CHECK (
        selection_status_id IN (
            'confirmed_candidate',
            'changed_to_candidate',
            'changed_outside_candidates',
            'routed_not_applicable'
        )
    ),
    CONSTRAINT policy_candidate_correction_review_projection_items_evidence_chk CHECK (
        jsonb_typeof(evidence_source_states) = 'array'
        AND jsonb_array_length(evidence_source_states) = 5
    )
);

CREATE TABLE IF NOT EXISTS policy_candidate_correction_review_projection_audit_events (
    id BIGSERIAL PRIMARY KEY,
    event_version SMALLINT NOT NULL DEFAULT 1,
    action_id VARCHAR(32) NOT NULL,
    actor_id INTEGER,
    projection_created_at TIMESTAMPTZ NOT NULL,
    configuration_revision CHAR(64) NOT NULL,
    item_count SMALLINT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_candidate_correction_review_projection_audit_events_version_chk CHECK (
        event_version = 1
    ),
    CONSTRAINT policy_candidate_correction_review_projection_audit_events_action_chk CHECK (
        action_id IN ('projection_created', 'projection_viewed', 'projection_expired')
    ),
    CONSTRAINT policy_candidate_correction_review_projection_audit_events_actor_chk CHECK (
        actor_id IS NULL OR actor_id > 0
    ),
    CONSTRAINT policy_candidate_correction_review_projection_audit_events_expired_actor_chk CHECK (
        (action_id = 'projection_expired' AND actor_id IS NULL)
        OR (action_id <> 'projection_expired' AND actor_id IS NOT NULL)
    ),
    CONSTRAINT policy_candidate_correction_review_projection_audit_events_revision_chk CHECK (
        configuration_revision ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT policy_candidate_correction_review_projection_audit_events_item_count_chk CHECK (
        item_count BETWEEN 0 AND 160
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_candidate_correction_review_projection_audit_events_recent
    ON policy_candidate_correction_review_projection_audit_events (occurred_at DESC, id DESC);

CREATE OR REPLACE FUNCTION guard_policy_candidate_correction_review_projection_audit_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Representative review-projection audit events are append-only';
END;
$$;

DROP TRIGGER IF EXISTS policy_candidate_correction_review_projection_audit_event_mutation_guard
    ON policy_candidate_correction_review_projection_audit_events;

CREATE TRIGGER policy_candidate_correction_review_projection_audit_event_mutation_guard
    BEFORE UPDATE OR DELETE ON policy_candidate_correction_review_projection_audit_events
    FOR EACH ROW
    EXECUTE FUNCTION guard_policy_candidate_correction_review_projection_audit_event_mutation();
