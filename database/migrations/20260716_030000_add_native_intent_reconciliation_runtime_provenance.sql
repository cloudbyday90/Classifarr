-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Persist only bounded release provenance with a reconciliation ledger header.
-- Image tags, container IDs, environment payloads, exception text, and raw
-- image metadata are intentionally excluded because they are mutable or may
-- disclose deployment internals. Existing rows become explicit `unknown`
-- provenance rather than being guessed from deployment state.

ALTER TABLE policy_native_intent_reconciliation_runs
    ADD COLUMN runtime_app_version VARCHAR(80) NOT NULL DEFAULT 'unknown',
    ADD COLUMN runtime_build_revision VARCHAR(64);

ALTER TABLE policy_native_intent_reconciliation_runs
    ADD CONSTRAINT policy_native_intent_reconcile_runs_app_version_chk CHECK (
        runtime_app_version ~ '^[0-9A-Za-z][0-9A-Za-z._+-]{0,79}$'
    ),
    ADD CONSTRAINT policy_native_intent_reconcile_runs_build_revision_chk CHECK (
        runtime_build_revision IS NULL
        OR runtime_build_revision ~ '^[a-f0-9]{7,64}$'
    );
