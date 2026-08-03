/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

-- A proposal is an opaque, short-lived admission record. It retains only the
-- canonical rules that can become native policy authority and a display-safe
-- summary. It never stores raw media-server, provider, or browser payloads.

CREATE TABLE IF NOT EXISTS policy_authoring_proposals (
    id BIGSERIAL PRIMARY KEY,
    proposal_reference VARCHAR(96) NOT NULL,
    library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    actor_id INTEGER NOT NULL,
    proposal_revision CHAR(64) NOT NULL,
    profile_fingerprint CHAR(64) NOT NULL,
    policy_name VARCHAR(255) NOT NULL,
    canonical_declared_intent JSONB NOT NULL,
    display_summary JSONB NOT NULL,
    state VARCHAR(20) NOT NULL DEFAULT 'prepared',
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_policy_id INTEGER REFERENCES library_policies(id) ON DELETE SET NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_authoring_proposals_reference_unique UNIQUE (proposal_reference),
    CONSTRAINT policy_authoring_proposals_reference_shape_chk CHECK (
        proposal_reference ~ '^[A-Za-z0-9_-]{32,96}$'
    ),
    CONSTRAINT policy_authoring_proposals_revision_shape_chk CHECK (
        proposal_revision ~ '^[a-f0-9]{64}$'
        AND profile_fingerprint ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT policy_authoring_proposals_payload_shape_chk CHECK (
        jsonb_typeof(canonical_declared_intent) = 'object'
        AND jsonb_typeof(display_summary) = 'object'
    ),
    CONSTRAINT policy_authoring_proposals_state_chk CHECK (
        state IN ('prepared', 'consumed')
    ),
    CONSTRAINT policy_authoring_proposals_consumption_shape_chk CHECK (
        (state = 'prepared' AND consumed_policy_id IS NULL AND consumed_at IS NULL)
        OR
        (state = 'consumed' AND consumed_policy_id IS NOT NULL AND consumed_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_authoring_proposals_library_state_expiry
    ON policy_authoring_proposals (library_id, state, expires_at);

CREATE INDEX IF NOT EXISTS idx_policy_authoring_proposals_actor_created
    ON policy_authoring_proposals (actor_id, created_at DESC);
