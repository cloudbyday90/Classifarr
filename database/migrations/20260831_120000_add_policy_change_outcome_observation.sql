/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

-- Stores one short-lived, aggregate-only outcome observation after an approved
-- native policy change. There is intentionally no policy, library, media,
-- provider, prompt, response, RAG, or raw-history reference in this table.
-- The internal receipt reference has no foreign key because receipts are
-- retained for 30 days while an observation must remain readable longer.

CREATE TABLE IF NOT EXISTS policy_candidate_correction_policy_change_outcome_observations (
    control_key VARCHAR(64) PRIMARY KEY,
    observation_version SMALLINT NOT NULL DEFAULT 1,
    hypothesis_id VARCHAR(64) NOT NULL UNIQUE,
    source_receipt_id BIGINT NOT NULL,
    source_intent_version INTEGER NOT NULL,
    target_intent_version INTEGER NOT NULL,
    baseline_window_start_at TIMESTAMPTZ NOT NULL,
    baseline_window_end_at TIMESTAMPTZ NOT NULL,
    followup_window_start_at TIMESTAMPTZ NOT NULL,
    followup_window_end_at TIMESTAMPTZ NOT NULL,
    outcome_count BIGINT NOT NULL,
    confirmed_leader_outcome_count BIGINT NOT NULL,
    changed_to_candidate_outcome_count BIGINT NOT NULL,
    changed_outside_candidates_outcome_count BIGINT NOT NULL,
    routed_not_applicable_outcome_count BIGINT NOT NULL,
    created_by_actor_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT policy_candidate_correction_policy_change_outcomes_key_chk CHECK (
        control_key = 'policy_change_outcome_observation'
    ),
    CONSTRAINT policy_candidate_correction_policy_change_outcomes_version_chk CHECK (
        observation_version = 1
    ),
    CONSTRAINT policy_candidate_correction_policy_change_outcomes_hypothesis_chk CHECK (
        hypothesis_id ~ '^pco_[A-Za-z0-9_-]{32}$'
    ),
    CONSTRAINT policy_candidate_correction_policy_change_outcomes_receipt_chk CHECK (
        source_receipt_id > 0
    ),
    CONSTRAINT policy_candidate_correction_policy_change_outcomes_revision_chk CHECK (
        source_intent_version > 0
        AND target_intent_version > source_intent_version
    ),
    CONSTRAINT policy_candidate_correction_policy_change_outcomes_windows_chk CHECK (
        baseline_window_start_at < baseline_window_end_at
        AND baseline_window_end_at <= followup_window_start_at
        AND followup_window_start_at < followup_window_end_at
    ),
    CONSTRAINT policy_candidate_correction_policy_change_outcomes_counts_chk CHECK (
        outcome_count >= 0
        AND confirmed_leader_outcome_count >= 0
        AND changed_to_candidate_outcome_count >= 0
        AND changed_outside_candidates_outcome_count >= 0
        AND routed_not_applicable_outcome_count >= 0
        AND outcome_count = confirmed_leader_outcome_count
            + changed_to_candidate_outcome_count
            + changed_outside_candidates_outcome_count
            + routed_not_applicable_outcome_count
    ),
    CONSTRAINT policy_candidate_correction_policy_change_outcomes_actor_chk CHECK (
        created_by_actor_id > 0
    ),
    CONSTRAINT policy_candidate_correction_policy_change_outcomes_expiry_chk CHECK (
        created_at < expires_at
        AND followup_window_end_at <= expires_at
    )
);
