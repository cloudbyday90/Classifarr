/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

CREATE INDEX IF NOT EXISTS idx_policy_native_intent_change_receipts_retention
    ON policy_native_intent_change_receipts (created_at ASC, id ASC);

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

        -- Retention has a separate, transaction-local permit and must never
        -- delete a receipt in the 30-day exact-replay window. The database
        -- enforces this invariant independently of the application query.
        IF current_setting(
               'classifarr.policy_native_intent_change_receipt_maintenance',
               true
           ) = 'retention_cleanup'
           AND OLD.created_at < NOW() - INTERVAL '30 days' THEN
            RETURN OLD;
        END IF;
    END IF;

    RAISE EXCEPTION 'Native intent change receipts are append-only';
END;
$$;
