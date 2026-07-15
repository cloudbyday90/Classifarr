-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Keep the original ledger migration immutable for already-upgraded installs.
-- These row-local constraints prevent a corrupted support record from claiming
-- more or fewer outcomes than it contains, or a retry time before evaluation.

ALTER TABLE policy_native_intent_reconciliation_runs
    ADD CONSTRAINT policy_native_intent_reconciliation_runs_count_total_chk CHECK (
        candidate_count = (
            converted_count
            + already_native_count
            + deferred_count
            + blocked_count
            + failed_count
        )
    );

ALTER TABLE policy_native_intent_reconciliation_outcomes
    ADD CONSTRAINT policy_native_intent_reconciliation_outcomes_retry_after_evaluation_chk CHECK (
        retry_not_before IS NULL OR retry_not_before >= evaluated_at
    );
