-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Phase 6R.3.3b: one compact, immutable receipt per server-owned learning
-- source event. The receipt is not a policy, a prompt, an actor record, or an
-- outcome payload. It binds the later transaction executor to the exact
-- command semantics that were committed for a source event.
--
-- classification_id intentionally has no foreign key. Configuration restore
-- can discard this runtime idempotency state while retained classification
-- history remains installation-owned. The executor must lock and verify the
-- classification before it inserts a receipt.

CREATE TABLE IF NOT EXISTS policy_authorized_outcome_source_event_receipts (
    id BIGSERIAL PRIMARY KEY,
    receipt_version SMALLINT NOT NULL DEFAULT 1,
    source_id VARCHAR(80) NOT NULL,
    source_event_id VARCHAR(160) NOT NULL,
    command_fingerprint CHAR(64) NOT NULL,
    classification_id BIGINT NOT NULL,
    destination_library_id BIGINT,
    final_outcome_status_id VARCHAR(80) NOT NULL,
    persistence_status_id VARCHAR(32) NOT NULL,
    learning_tier_id VARCHAR(40),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_authorized_outcome_receipts_version_chk CHECK (
        receipt_version = 1
    ),
    CONSTRAINT policy_authorized_outcome_receipts_source_chk CHECK (
        source_id IN (
            'manual_classification_change',
            'operator_confirmation',
            'discord_pending_answer',
            'request_destination_choice',
            'arr_routing_outcome'
        )
    ),
    CONSTRAINT policy_authorized_outcome_receipts_source_event_chk CHECK (
        char_length(btrim(source_event_id)) BETWEEN 1 AND 160
    ),
    CONSTRAINT policy_authorized_outcome_receipts_fingerprint_chk CHECK (
        command_fingerprint ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT policy_authorized_outcome_receipts_classification_chk CHECK (
        classification_id > 0
    ),
    CONSTRAINT policy_authorized_outcome_receipts_destination_chk CHECK (
        destination_library_id IS NULL OR destination_library_id > 0
    ),
    CONSTRAINT policy_authorized_outcome_receipts_outcome_status_chk CHECK (
        final_outcome_status_id IN (
            'resolved',
            'routed',
            'route_failed_missing_mapping'
        )
    ),
    CONSTRAINT policy_authorized_outcome_receipts_persistence_status_chk CHECK (
        persistence_status_id IN ('ready', 'outcome_only')
    ),
    CONSTRAINT policy_authorized_outcome_receipts_learning_shape_chk CHECK (
        (persistence_status_id = 'outcome_only' AND learning_tier_id IS NULL)
        OR
        (
            persistence_status_id = 'ready'
            AND learning_tier_id IN (
                'exact_item_memory',
                'compatibility_evidence',
                'identity_evidence'
            )
        )
    ),
    CONSTRAINT policy_authorized_outcome_receipts_source_event_unique UNIQUE (
        source_id,
        source_event_id
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_authorized_outcome_receipts_classification
    ON policy_authorized_outcome_source_event_receipts (
        classification_id,
        created_at DESC,
        id DESC
    );

CREATE OR REPLACE FUNCTION guard_policy_authorized_outcome_receipt_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- A replace restore starts a new runtime boundary. The caller must opt in
    -- locally inside its transaction; normal application paths cannot rewrite
    -- or remove receipts.
    IF TG_OP = 'DELETE'
       AND current_setting(
           'classifarr.policy_authorized_outcome_receipt_maintenance',
           true
       ) = 'replace_restore' THEN
        RETURN OLD;
    END IF;

    RAISE EXCEPTION 'Authorized outcome source-event receipts are append-only';
END;
$$;

DROP TRIGGER IF EXISTS policy_authorized_outcome_receipt_mutation_guard
    ON policy_authorized_outcome_source_event_receipts;

CREATE TRIGGER policy_authorized_outcome_receipt_mutation_guard
    BEFORE UPDATE OR DELETE ON policy_authorized_outcome_source_event_receipts
    FOR EACH ROW
    EXECUTE FUNCTION guard_policy_authorized_outcome_receipt_mutation();
