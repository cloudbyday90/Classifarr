-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- A deliberately redacted, short-lived link across queue cleanup and history.
CREATE TABLE IF NOT EXISTS classification_intake_receipts (
    queue_task_id bigint PRIMARY KEY CHECK (queue_task_id > 0),
    webhook_log_id bigint CHECK (webhook_log_id > 0),
    classification_id integer CHECK (classification_id > 0),
    source_class text NOT NULL CHECK (source_class IN ('webhook', 'manual', 'reprocess', 'other')),
    status_id text NOT NULL CHECK (status_id IN
        ('queued', 'processing', 'retry_scheduled', 'completed', 'failed', 'cancelled')),
    comparison_status_id text NOT NULL DEFAULT 'not_evaluated' CHECK (comparison_status_id IN
        ('not_evaluated', 'captured', 'not_captured')),
    comparison_reason_id text CHECK (
        comparison_reason_id IS NULL OR comparison_reason_id IN (
            'not_applicable_media', 'no_policy_result', 'no_eligible_pool',
            'invalid_candidate_pool', 'candidate_pool_size', 'retrieval_unavailable',
            'retrieval_mismatch', 'description_unavailable', 'comparison_incomplete',
            'identity_mismatch', 'capture_disabled', 'capture_invalid',
            'unexpected_error', 'not_observed'
        )),
    attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 10000),
    last_failure_code text CHECK (
        last_failure_code IS NULL OR last_failure_code ~ '^[a-z][a-z0-9_]{0,63}$'),
    queued_at timestamptz NOT NULL,
    started_at timestamptz,
    finished_at timestamptz,
    classification_linked_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    CONSTRAINT classification_intake_comparison_reason_check CHECK (
        (comparison_status_id = 'not_captured') = (comparison_reason_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_classification_intake_receipts_queued
    ON classification_intake_receipts (queued_at DESC, queue_task_id DESC);

COMMENT ON TABLE classification_intake_receipts IS
    'Thirty-day, id-only classification intake diagnostics; no media, provider, policy, user, request body, AI, or routing content.';
