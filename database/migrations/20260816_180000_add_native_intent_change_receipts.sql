/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

-- A native intent change creates a new authority revision. Retain only the
-- minimum durable receipt required to replay a response-loss retry: who made
-- the request, which policy/revision and canonical command fingerprint it
-- bound to, and the committed intent/event references. Rule values, provider
-- output, compatibility data, routing data, and AI data are deliberately not
-- retained here.

CREATE TABLE IF NOT EXISTS policy_native_intent_change_receipts (
    id BIGSERIAL PRIMARY KEY,
    receipt_version SMALLINT NOT NULL DEFAULT 1,
    policy_id INTEGER NOT NULL REFERENCES library_policies(id) ON DELETE CASCADE,
    actor_id INTEGER NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    command_fingerprint CHAR(64) NOT NULL,
    source_intent_version INTEGER NOT NULL,
    target_intent_id BIGINT NOT NULL REFERENCES policy_intents(id) ON DELETE RESTRICT,
    target_intent_version INTEGER NOT NULL,
    migration_event_id BIGINT NOT NULL REFERENCES policy_intent_migration_events(id) ON DELETE RESTRICT,
    applied_command_ids JSONB NOT NULL,
    result_status_id VARCHAR(32) NOT NULL DEFAULT 'applied',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_native_intent_change_receipts_version_chk CHECK (
        receipt_version = 1
    ),
    CONSTRAINT policy_native_intent_change_receipts_actor_chk CHECK (
        actor_id > 0
    ),
    CONSTRAINT policy_native_intent_change_receipts_idempotency_shape_chk CHECK (
        idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_-]{31,127}$'
    ),
    CONSTRAINT policy_native_intent_change_receipts_fingerprint_shape_chk CHECK (
        command_fingerprint ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT policy_native_intent_change_receipts_version_order_chk CHECK (
        source_intent_version > 0
        AND target_intent_version > source_intent_version
    ),
    CONSTRAINT policy_native_intent_change_receipts_command_shape_chk CHECK (
        jsonb_typeof(applied_command_ids) = 'array'
        AND jsonb_array_length(applied_command_ids) BETWEEN 1 AND 6
    ),
    CONSTRAINT policy_native_intent_change_receipts_result_status_chk CHECK (
        result_status_id = 'applied'
    ),
    CONSTRAINT policy_native_intent_change_receipts_idempotency_unique UNIQUE (
        idempotency_key
    ),
    CONSTRAINT policy_native_intent_change_receipts_target_intent_unique UNIQUE (
        target_intent_id
    ),
    CONSTRAINT policy_native_intent_change_receipts_event_unique UNIQUE (
        migration_event_id
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_native_intent_change_receipts_actor_policy
    ON policy_native_intent_change_receipts (actor_id, policy_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION guard_policy_native_intent_change_receipt_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        -- Replace restore starts a new runtime boundary. It may clear
        -- operational retry state only through an explicit transaction-local
        -- permit. A foreign-key cascade caused by deleting the parent policy
        -- is also legitimate; the receipt cannot outlive that policy.
        IF current_setting(
               'classifarr.policy_native_intent_change_receipt_maintenance',
               true
           ) = 'replace_restore'
           OR NOT EXISTS (
               SELECT 1
               FROM library_policies
               WHERE id = OLD.policy_id
           ) THEN
            RETURN OLD;
        END IF;
    END IF;

    RAISE EXCEPTION 'Native intent change receipts are append-only';
END;
$$;

DROP TRIGGER IF EXISTS policy_native_intent_change_receipt_mutation_guard
    ON policy_native_intent_change_receipts;

CREATE TRIGGER policy_native_intent_change_receipt_mutation_guard
    BEFORE UPDATE OR DELETE ON policy_native_intent_change_receipts
    FOR EACH ROW
    EXECUTE FUNCTION guard_policy_native_intent_change_receipt_mutation();
