-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- The original outbox represented only refreshes caused by admitted learning.
-- Native-policy readiness needs the same durable worker when an active policy's
-- stored library profile is missing or stale. Generalize the operational record
-- without inventing a classification or learning event for that server-owned
-- recovery work. A partial unique index coalesces active refreshes per library;
-- one completed refresh is sufficient for every queued reason at that point.

ALTER TABLE policy_profile_refresh_outbox
    ADD COLUMN request_type VARCHAR(40) NOT NULL DEFAULT 'learning_evidence';

ALTER TABLE policy_profile_refresh_outbox
    DROP CONSTRAINT policy_profile_refresh_outbox_identifiers_chk,
    DROP CONSTRAINT policy_profile_refresh_outbox_learning_operation_chk,
    DROP CONSTRAINT policy_profile_refresh_outbox_candidate_key_chk,
    DROP CONSTRAINT policy_profile_refresh_outbox_reason_chk,
    DROP CONSTRAINT policy_profile_refresh_outbox_source_system_chk;

ALTER TABLE policy_profile_refresh_outbox
    ALTER COLUMN classification_id DROP NOT NULL,
    ALTER COLUMN learning_operation_id DROP NOT NULL,
    ALTER COLUMN learning_tier_id DROP NOT NULL,
    ALTER COLUMN candidate_key DROP NOT NULL;

-- An in-flight worker retains precedence during upgrade. Any other active row
-- for that library is coalesced into that refresh before the unique index is
-- created. This migration runs transactionally, so no caller sees an
-- unconstrained queue shape.
WITH ranked_active_rows AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY library_id
            ORDER BY
                CASE WHEN processing_state = 'processing' THEN 0 ELSE 1 END,
                created_at ASC,
                id ASC
        ) AS active_rank
    FROM policy_profile_refresh_outbox
    WHERE processing_state IN ('pending', 'processing')
)
UPDATE policy_profile_refresh_outbox AS outbox
SET
    processing_state = 'completed',
    claim_token = NULL,
    claimed_at = NULL,
    lease_expires_at = NULL,
    completed_at = NOW(),
    failure_code = NULL,
    updated_at = NOW()
FROM ranked_active_rows AS ranked
WHERE outbox.id = ranked.id
  AND ranked.active_rank > 1;

ALTER TABLE policy_profile_refresh_outbox
    ADD CONSTRAINT policy_profile_refresh_outbox_identifiers_chk CHECK (
        library_id > 0
        AND (classification_id IS NULL OR classification_id > 0)
    ),
    ADD CONSTRAINT policy_profile_refresh_outbox_request_type_chk CHECK (
        request_type IN ('learning_evidence', 'native_readiness')
    ),
    ADD CONSTRAINT policy_profile_refresh_outbox_request_shape_chk CHECK (
        (
            request_type = 'learning_evidence'
            AND classification_id IS NOT NULL
            AND learning_operation_id IN (
                'write_compatibility_evidence',
                'write_identity_evidence'
            )
            AND learning_tier_id IN ('compatibility_evidence', 'identity_evidence')
            AND (
                (learning_operation_id = 'write_compatibility_evidence'
                 AND learning_tier_id = 'compatibility_evidence')
                OR
                (learning_operation_id = 'write_identity_evidence'
                 AND learning_tier_id = 'identity_evidence')
            )
            AND char_length(btrim(candidate_key)) BETWEEN 3 AND 160
            AND refresh_reason_id = 'profile_refresh_required'
            AND source_system = 'policy_authorized_profile_refresh'
        )
        OR
        (
            request_type = 'native_readiness'
            AND classification_id IS NULL
            AND learning_operation_id IS NULL
            AND learning_tier_id IS NULL
            AND candidate_key IS NULL
            AND source_id = 'native_policy_profile_readiness'
            AND refresh_reason_id = 'stale_library_profile'
            AND source_system = 'policy_native_readiness_profile_refresh'
        )
    );

CREATE UNIQUE INDEX idx_policy_profile_refresh_outbox_active_library
    ON policy_profile_refresh_outbox (library_id)
    WHERE processing_state IN ('pending', 'processing');
