/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

-- Stores a single, short-lived reviewed conclusion for the current aggregate
-- policy-change outcome. It intentionally retains no policy/library/media,
-- provider, prompt, response, RAG, or free-text content. The opaque outcome
-- reference has no foreign key because retention deletes this row first.

CREATE TABLE IF NOT EXISTS policy_candidate_correction_policy_change_decision_records (
    control_key VARCHAR(64) PRIMARY KEY,
    record_version SMALLINT NOT NULL DEFAULT 1,
    observation_hypothesis_id VARCHAR(64) NOT NULL UNIQUE,
    decision_id VARCHAR(64) NOT NULL,
    rationale_id VARCHAR(64) NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    created_by_actor_id INTEGER NOT NULL,
    updated_by_actor_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT policy_candidate_correction_policy_change_decision_key_chk CHECK (
        control_key = 'policy_change_decision_record'
    ),
    CONSTRAINT policy_candidate_correction_policy_change_decision_version_chk CHECK (
        record_version = 1
    ),
    CONSTRAINT policy_candidate_correction_policy_change_decision_hypothesis_chk CHECK (
        observation_hypothesis_id ~ '^pco_[A-Za-z0-9_-]{32}$'
    ),
    CONSTRAINT policy_candidate_correction_policy_change_decision_choice_chk CHECK (
        decision_id IN (
            'retain_current_policy',
            'investigate_policy_evidence',
            'prepare_manual_policy_change'
        )
    ),
    CONSTRAINT policy_candidate_correction_policy_change_decision_rationale_chk CHECK (
        rationale_id IN (
            'outcome_improved',
            'outcome_unchanged_or_inconclusive',
            'outcome_degraded',
            'requires_contextual_review'
        )
    ),
    CONSTRAINT policy_candidate_correction_policy_change_decision_revision_chk CHECK (
        revision > 0
    ),
    CONSTRAINT policy_candidate_correction_policy_change_decision_actor_chk CHECK (
        created_by_actor_id > 0
        AND updated_by_actor_id > 0
    ),
    CONSTRAINT policy_candidate_correction_policy_change_decision_timestamps_chk CHECK (
        created_at <= updated_at
        AND updated_at < expires_at
    )
);
