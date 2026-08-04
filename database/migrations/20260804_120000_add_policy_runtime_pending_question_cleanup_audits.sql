-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Phase 5R.7.3: Append-only, bounded receipts for server-derived pending
-- question cleanup. The table intentionally has no foreign key to runtime
-- classification history so restore and retention workflows can reset runtime
-- state without being blocked by an audit receipt. It stores only controlled
-- identifiers, never questions, AI/provider content, or response text.

CREATE OR REPLACE FUNCTION is_policy_runtime_pending_question_cleanup_reason_ids(value JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    reason_id TEXT;
BEGIN
    IF jsonb_typeof(value) <> 'array' OR jsonb_array_length(value) > 20 THEN
        RETURN FALSE;
    END IF;

    FOR reason_id IN SELECT jsonb_array_elements_text(value)
    LOOP
        IF reason_id !~ '^[a-z0-9_]{1,120}$' THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$;

CREATE TABLE IF NOT EXISTS policy_runtime_pending_question_cleanup_audits (
    id BIGSERIAL PRIMARY KEY,
    audit_version SMALLINT NOT NULL DEFAULT 1,
    classification_id BIGINT NOT NULL,
    action_id VARCHAR(80) NOT NULL,
    reason_ids JSONB NOT NULL,
    source_version VARCHAR(120) NOT NULL,
    actor_id VARCHAR(160) NOT NULL,
    result_status_id VARCHAR(80) NOT NULL,
    replay_receipt UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_runtime_pending_question_cleanup_audits_version_chk CHECK (
        audit_version = 1
    ),
    CONSTRAINT policy_runtime_pending_question_cleanup_audits_classification_chk CHECK (
        classification_id > 0
    ),
    CONSTRAINT policy_runtime_pending_question_cleanup_audits_action_chk CHECK (
        action_id IN (
            'none',
            'regenerate_under_current_contract',
            'mark_stale_require_retry',
            'resolve_outcome_only',
            'block_learning_permanently'
        )
    ),
    CONSTRAINT policy_runtime_pending_question_cleanup_audits_reason_ids_chk CHECK (
        is_policy_runtime_pending_question_cleanup_reason_ids(reason_ids)
    ),
    CONSTRAINT policy_runtime_pending_question_cleanup_audits_source_chk CHECK (
        source_version = 'policy.runtime_pending_question_cleanup.v1'
    ),
    CONSTRAINT policy_runtime_pending_question_cleanup_audits_actor_chk CHECK (
        actor_id ~ '^[A-Za-z0-9:_-]{1,160}$'
    ),
    CONSTRAINT policy_runtime_pending_question_cleanup_audits_status_chk CHECK (
        result_status_id IN (
            'unchanged',
            'queued_fresh_runtime_evaluation',
            'resolved_outcome_only'
        )
    ),
    CONSTRAINT policy_runtime_pending_question_cleanup_audits_replay_unique UNIQUE (
        replay_receipt
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_runtime_pending_question_cleanup_audits_classification
    ON policy_runtime_pending_question_cleanup_audits (
        classification_id,
        created_at DESC,
        id DESC
    );

CREATE OR REPLACE FUNCTION guard_policy_runtime_pending_question_cleanup_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Pending-question cleanup audit records are append-only';
END;
$$;

DROP TRIGGER IF EXISTS policy_runtime_pending_question_cleanup_audit_mutation_guard
    ON policy_runtime_pending_question_cleanup_audits;

CREATE TRIGGER policy_runtime_pending_question_cleanup_audit_mutation_guard
    BEFORE UPDATE OR DELETE ON policy_runtime_pending_question_cleanup_audits
    FOR EACH ROW
    EXECUTE FUNCTION guard_policy_runtime_pending_question_cleanup_audit_mutation();
