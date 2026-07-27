-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Keep profile refresh processing independent from the evidence transaction.
-- Claims are short lived, server-owned, and retryable; no client or provider
-- payload is persisted with this operational state.

ALTER TABLE policy_profile_refresh_outbox
    ADD COLUMN processing_state VARCHAR(16) NOT NULL DEFAULT 'pending',
    ADD COLUMN attempt_count SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN claim_token UUID,
    ADD COLUMN claimed_at TIMESTAMPTZ,
    ADD COLUMN lease_expires_at TIMESTAMPTZ,
    ADD COLUMN completed_at TIMESTAMPTZ,
    ADD COLUMN failure_code VARCHAR(80),
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE policy_profile_refresh_outbox
    ADD CONSTRAINT policy_profile_refresh_outbox_processing_state_chk CHECK (
        processing_state IN ('pending', 'processing', 'completed', 'failed')
    ),
    ADD CONSTRAINT policy_profile_refresh_outbox_attempt_count_chk CHECK (
        attempt_count BETWEEN 0 AND 3
    ),
    ADD CONSTRAINT policy_profile_refresh_outbox_failure_code_chk CHECK (
        failure_code IS NULL
        OR char_length(btrim(failure_code)) BETWEEN 1 AND 80
    ),
    ADD CONSTRAINT policy_profile_refresh_outbox_worker_lifecycle_chk CHECK (
        (
            processing_state = 'pending'
            AND claim_token IS NULL
            AND claimed_at IS NULL
            AND lease_expires_at IS NULL
            AND completed_at IS NULL
        )
        OR (
            processing_state = 'processing'
            AND claim_token IS NOT NULL
            AND claimed_at IS NOT NULL
            AND lease_expires_at IS NOT NULL
            AND completed_at IS NULL
        )
        OR (
            processing_state = 'completed'
            AND claim_token IS NULL
            AND claimed_at IS NULL
            AND lease_expires_at IS NULL
            AND completed_at IS NOT NULL
        )
        OR (
            processing_state = 'failed'
            AND claim_token IS NULL
            AND claimed_at IS NULL
            AND lease_expires_at IS NULL
            AND completed_at IS NULL
        )
    );

CREATE INDEX idx_policy_profile_refresh_outbox_pending_available
    ON policy_profile_refresh_outbox (available_at ASC, created_at ASC, id ASC)
    WHERE processing_state = 'pending';

CREATE INDEX idx_policy_profile_refresh_outbox_processing_lease
    ON policy_profile_refresh_outbox (lease_expires_at ASC, id ASC)
    WHERE processing_state = 'processing';
