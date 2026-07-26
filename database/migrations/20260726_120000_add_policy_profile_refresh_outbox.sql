-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- A committed source event can change destination evidence and therefore
-- require profile regeneration. Store that compact intent in the same
-- transaction as the evidence mutation; the later worker reads only committed
-- rows. This is runtime state, not user configuration, so replace restore
-- explicitly clears it instead of importing it from a backup.

CREATE TABLE IF NOT EXISTS policy_profile_refresh_outbox (
    id BIGSERIAL PRIMARY KEY,
    outbox_version SMALLINT NOT NULL DEFAULT 1,
    source_id VARCHAR(80) NOT NULL,
    source_event_id VARCHAR(160) NOT NULL,
    classification_id BIGINT NOT NULL,
    library_id BIGINT NOT NULL,
    learning_operation_id VARCHAR(80) NOT NULL,
    learning_tier_id VARCHAR(40) NOT NULL,
    candidate_key VARCHAR(160) NOT NULL,
    refresh_reason_id VARCHAR(80) NOT NULL,
    source_system VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_profile_refresh_outbox_version_chk CHECK (
        outbox_version = 1
    ),
    CONSTRAINT policy_profile_refresh_outbox_source_event_chk CHECK (
        char_length(btrim(source_id)) BETWEEN 1 AND 80
        AND char_length(btrim(source_event_id)) BETWEEN 1 AND 160
    ),
    CONSTRAINT policy_profile_refresh_outbox_identifiers_chk CHECK (
        classification_id > 0
        AND library_id > 0
    ),
    CONSTRAINT policy_profile_refresh_outbox_learning_operation_chk CHECK (
        learning_operation_id IN (
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
    ),
    CONSTRAINT policy_profile_refresh_outbox_candidate_key_chk CHECK (
        char_length(btrim(candidate_key)) BETWEEN 3 AND 160
    ),
    CONSTRAINT policy_profile_refresh_outbox_reason_chk CHECK (
        refresh_reason_id = 'profile_refresh_required'
    ),
    CONSTRAINT policy_profile_refresh_outbox_source_system_chk CHECK (
        source_system = 'policy_authorized_profile_refresh'
    ),
    CONSTRAINT policy_profile_refresh_outbox_source_event_unique UNIQUE (
        source_id,
        source_event_id
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_profile_refresh_outbox_library_created
    ON policy_profile_refresh_outbox (library_id, created_at ASC, id ASC);
