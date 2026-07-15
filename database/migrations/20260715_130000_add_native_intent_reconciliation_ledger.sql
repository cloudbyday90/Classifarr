-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Phase 8R.3.2.2: durable, bounded reconciliation evidence.
-- These tables deliberately retain only policy references, stable state and
-- reason identifiers, and deterministic fingerprints. Policy payloads,
-- prompts, provider responses, and traces must not be written here.

CREATE TABLE IF NOT EXISTS policy_native_intent_reconciliation_runs (
    id BIGSERIAL PRIMARY KEY,
    run_key UUID NOT NULL,
    reconciler_version VARCHAR(80) NOT NULL,
    run_state VARCHAR(40) NOT NULL,
    source_status_id VARCHAR(80) NOT NULL,
    reason_id VARCHAR(80) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL,
    candidate_count INTEGER NOT NULL DEFAULT 0,
    converted_count INTEGER NOT NULL DEFAULT 0,
    already_native_count INTEGER NOT NULL DEFAULT 0,
    deferred_count INTEGER NOT NULL DEFAULT 0,
    blocked_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_native_intent_reconciliation_runs_key_uniq UNIQUE (run_key),
    CONSTRAINT policy_native_intent_reconciliation_runs_state_chk CHECK (
        run_state IN ('applied', 'evaluated', 'deferred', 'failed')
    ),
    CONSTRAINT policy_native_intent_reconciliation_runs_status_id_chk CHECK (
        source_status_id ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'
    ),
    CONSTRAINT policy_native_intent_reconciliation_runs_reason_id_chk CHECK (
        reason_id ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'
    ),
    CONSTRAINT policy_native_intent_reconciliation_runs_finished_after_started_chk CHECK (
        finished_at >= started_at
    ),
    CONSTRAINT policy_native_intent_reconciliation_runs_counts_chk CHECK (
        candidate_count >= 0
        AND converted_count >= 0
        AND already_native_count >= 0
        AND deferred_count >= 0
        AND blocked_count >= 0
        AND failed_count >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_native_intent_reconciliation_runs_finished
    ON policy_native_intent_reconciliation_runs (finished_at, id);

CREATE TABLE IF NOT EXISTS policy_native_intent_reconciliation_outcomes (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT NOT NULL REFERENCES policy_native_intent_reconciliation_runs(id) ON DELETE CASCADE,
    policy_id INTEGER NOT NULL REFERENCES library_policies(id) ON DELETE CASCADE,
    candidate_fingerprint VARCHAR(71) NOT NULL,
    candidate_status_id VARCHAR(80) NOT NULL,
    outcome_state VARCHAR(40) NOT NULL,
    reason_id VARCHAR(80) NOT NULL,
    retry_not_before TIMESTAMPTZ,
    evaluated_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_native_intent_reconciliation_outcomes_run_policy_uniq UNIQUE (run_id, policy_id),
    CONSTRAINT policy_native_intent_reconciliation_outcomes_fingerprint_chk CHECK (
        candidate_fingerprint ~ '^sha256:[a-f0-9]{64}$'
    ),
    CONSTRAINT policy_native_intent_reconciliation_outcomes_candidate_status_chk CHECK (
        candidate_status_id ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'
    ),
    CONSTRAINT policy_native_intent_reconciliation_outcomes_state_chk CHECK (
        outcome_state IN (
            'applied',
            'already_native',
            'deferred_retry',
            'blocked_current_state',
            'system_failure'
        )
    ),
    CONSTRAINT policy_native_intent_reconciliation_outcomes_reason_id_chk CHECK (
        reason_id ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_native_intent_reconciliation_outcomes_policy
    ON policy_native_intent_reconciliation_outcomes (policy_id, evaluated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_policy_native_intent_reconciliation_outcomes_retention
    ON policy_native_intent_reconciliation_outcomes (created_at, id);
