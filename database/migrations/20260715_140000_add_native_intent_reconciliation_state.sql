-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Phase 8R.3.2.3: current, policy-local retry and maintenance disposition.
-- This is a scheduling control plane, not a policy source of truth. It stores
-- only stable IDs, a candidate fingerprint, timestamps, and bounded counters.
-- Never add policy JSON, prompts, provider payloads, exception messages, or
-- credentials to this table.

ALTER TABLE policy_native_intent_reconciliation_outcomes
    DROP CONSTRAINT IF EXISTS policy_native_intent_reconciliation_outcomes_state_chk;

ALTER TABLE policy_native_intent_reconciliation_outcomes
    ADD CONSTRAINT policy_native_intent_reconciliation_outcomes_state_chk CHECK (
        outcome_state IN (
            'applied',
            'already_native',
            'deferred_retry',
            'blocked_current_state',
            'requires_maintenance',
            'system_failure'
        )
    );

CREATE TABLE IF NOT EXISTS policy_native_intent_reconciliation_states (
    policy_id INTEGER PRIMARY KEY REFERENCES library_policies(id) ON DELETE CASCADE,
    candidate_fingerprint VARCHAR(71) NOT NULL,
    candidate_status_id VARCHAR(80) NOT NULL,
    outcome_state VARCHAR(40) NOT NULL,
    reason_id VARCHAR(80) NOT NULL,
    retry_not_before TIMESTAMPTZ,
    failure_count INTEGER NOT NULL DEFAULT 0,
    evaluated_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_native_intent_reconciliation_states_fingerprint_chk CHECK (
        candidate_fingerprint ~ '^sha256:[a-f0-9]{64}$'
    ),
    CONSTRAINT policy_native_intent_reconciliation_states_candidate_status_chk CHECK (
        candidate_status_id ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'
    ),
    CONSTRAINT policy_native_intent_reconciliation_states_outcome_chk CHECK (
        outcome_state IN (
            'deferred_retry',
            'blocked_current_state',
            'requires_maintenance',
            'system_failure'
        )
    ),
    CONSTRAINT policy_native_intent_reconciliation_states_reason_chk CHECK (
        reason_id ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'
    ),
    CONSTRAINT policy_native_intent_reconciliation_states_failure_count_chk CHECK (
        failure_count >= 0 AND failure_count <= 3
    ),
    CONSTRAINT policy_native_intent_reconciliation_states_retry_state_chk CHECK (
        (
            outcome_state IN ('deferred_retry', 'system_failure')
            AND retry_not_before IS NOT NULL
        )
        OR (
            outcome_state IN ('blocked_current_state', 'requires_maintenance')
            AND retry_not_before IS NULL
        )
    ),
    CONSTRAINT policy_native_intent_reconciliation_states_retry_after_eval_chk CHECK (
        retry_not_before IS NULL OR retry_not_before >= evaluated_at
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_native_intent_reconciliation_states_retry
    ON policy_native_intent_reconciliation_states (retry_not_before, policy_id)
    WHERE outcome_state IN ('deferred_retry', 'system_failure');

CREATE INDEX IF NOT EXISTS idx_policy_native_intent_reconciliation_states_outcome
    ON policy_native_intent_reconciliation_states (outcome_state, evaluated_at, policy_id);
