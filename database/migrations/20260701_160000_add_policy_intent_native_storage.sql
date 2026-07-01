/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

-- Phase 8R native policy intent storage.
-- This migration creates the durable native intent tables defined by the
-- Phase 8R.1 schema contract. It intentionally stores final intent authority,
-- migration events, bounded rollback snapshots, and validation status without
-- preserving legacy customSignals as a permanent second policy model.

CREATE TABLE IF NOT EXISTS policy_intents (
    id BIGSERIAL PRIMARY KEY,
    policy_id INTEGER NOT NULL REFERENCES library_policies(id) ON DELETE CASCADE,
    library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    schema_version INTEGER NOT NULL DEFAULT 1,
    intent_version INTEGER NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    source VARCHAR(40) NOT NULL,
    inference_state VARCHAR(40) NOT NULL,
    review_behavior JSONB NOT NULL DEFAULT '{}'::jsonb,
    validation_status VARCHAR(40) NOT NULL DEFAULT 'pending_validation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    replaced_by_intent_id BIGINT REFERENCES policy_intents(id) ON DELETE SET NULL,
    CONSTRAINT policy_intents_schema_version_chk CHECK (schema_version = 1),
    CONSTRAINT policy_intents_intent_version_chk CHECK (intent_version > 0),
    CONSTRAINT policy_intents_source_chk CHECK (source IN ('empty', 'legacy_presets', 'native_intent')),
    CONSTRAINT policy_intents_inference_state_chk CHECK (inference_state IN ('empty', 'inferred', 'partial')),
    CONSTRAINT policy_intents_review_behavior_shape_chk CHECK (jsonb_typeof(review_behavior) = 'object'),
    CONSTRAINT policy_intents_validation_status_chk CHECK (
        validation_status IN ('pending_validation', 'valid', 'invalid', 'warning')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_intents_active_version
    ON policy_intents (policy_id, intent_version)
    WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_policy_intents_policy_lookup
    ON policy_intents (policy_id);

CREATE INDEX IF NOT EXISTS idx_policy_intents_library_lookup
    ON policy_intents (library_id);

CREATE INDEX IF NOT EXISTS idx_policy_intents_validation_status
    ON policy_intents (validation_status);

CREATE TABLE IF NOT EXISTS policy_intent_rules (
    id BIGSERIAL PRIMARY KEY,
    intent_id BIGINT NOT NULL REFERENCES policy_intents(id) ON DELETE CASCADE,
    intent_role VARCHAR(40) NOT NULL,
    collection VARCHAR(40) NOT NULL,
    signal_type VARCHAR(50) NOT NULL,
    operator VARCHAR(50) NOT NULL,
    values JSONB NOT NULL DEFAULT '{}'::jsonb,
    constraint_mode VARCHAR(30),
    semantics VARCHAR(30),
    source VARCHAR(50),
    inference_state VARCHAR(40) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_intent_rules_role_chk CHECK (
        intent_role IN ('purpose', 'hard_limit', 'helpful_hint', 'avoid')
    ),
    CONSTRAINT policy_intent_rules_collection_chk CHECK (
        collection IN ('purpose', 'hard_limits', 'helpful_hints', 'avoid')
    ),
    CONSTRAINT policy_intent_rules_signal_type_chk CHECK (
        signal_type IN (
            'genres',
            'keywords',
            'studios',
            'language',
            'media_type',
            'certifications',
            'release_year',
            'vote_average',
            'runtime'
        )
    ),
    CONSTRAINT policy_intent_rules_operator_chk CHECK (
        operator IN (
            'require_all',
            'require_any',
            'prefer',
            'include',
            'exclude',
            'max',
            'range',
            'runtime_range',
            'configured'
        )
    ),
    CONSTRAINT policy_intent_rules_values_shape_chk CHECK (jsonb_typeof(values) = 'object'),
    CONSTRAINT policy_intent_rules_constraint_mode_chk CHECK (
        constraint_mode IS NULL OR constraint_mode IN ('strict', 'advisory')
    ),
    CONSTRAINT policy_intent_rules_semantics_chk CHECK (
        semantics IS NULL OR semantics IN ('identity', 'compatibility')
    ),
    CONSTRAINT policy_intent_rules_inference_state_chk CHECK (
        inference_state IN ('empty', 'inferred', 'partial')
    ),
    CONSTRAINT policy_intent_rules_collection_role_chk CHECK (
        (collection = 'purpose' AND intent_role = 'purpose')
        OR (collection = 'hard_limits' AND intent_role = 'hard_limit')
        OR (collection = 'helpful_hints' AND intent_role = 'helpful_hint')
        OR (collection = 'avoid' AND intent_role = 'avoid')
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_intent_rules_lookup
    ON policy_intent_rules (intent_id, intent_role, signal_type);

CREATE INDEX IF NOT EXISTS idx_policy_intent_rules_values_gin
    ON policy_intent_rules USING GIN (values);

CREATE TABLE IF NOT EXISTS policy_intent_routing_targets (
    id BIGSERIAL PRIMARY KEY,
    intent_id BIGINT NOT NULL REFERENCES policy_intents(id) ON DELETE CASCADE,
    library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    arr_type VARCHAR(20),
    arr_config_id INTEGER,
    arr_root_folder_id INTEGER,
    arr_root_folder_path TEXT,
    quality_profile_id INTEGER,
    target_status VARCHAR(40) NOT NULL DEFAULT 'configured',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_intent_routing_targets_arr_type_chk CHECK (
        arr_type IS NULL OR arr_type IN ('radarr', 'sonarr')
    ),
    CONSTRAINT policy_intent_routing_targets_status_chk CHECK (
        target_status IN ('configured', 'missing', 'disabled', 'review_required')
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_intent_routing_targets_lookup
    ON policy_intent_routing_targets (intent_id, library_id, target_status);

CREATE TABLE IF NOT EXISTS policy_intent_template_applications (
    id BIGSERIAL PRIMARY KEY,
    intent_id BIGINT NOT NULL REFERENCES policy_intents(id) ON DELETE CASCADE,
    preset_id INTEGER REFERENCES content_presets(id) ON DELETE SET NULL,
    preset_key VARCHAR(100),
    preset_name VARCHAR(255),
    weight NUMERIC(6,3),
    signal_count INTEGER NOT NULL DEFAULT 0,
    link_state VARCHAR(40) NOT NULL DEFAULT 'applied',
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_intent_template_applications_signal_count_chk CHECK (signal_count >= 0),
    CONSTRAINT policy_intent_template_applications_link_state_chk CHECK (
        link_state IN ('applied', 'removed', 'replaced', 'ignored')
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_intent_template_applications_lookup
    ON policy_intent_template_applications (intent_id, preset_id);

CREATE TABLE IF NOT EXISTS policy_intent_migration_events (
    id BIGSERIAL PRIMARY KEY,
    intent_id BIGINT REFERENCES policy_intents(id) ON DELETE SET NULL,
    policy_id INTEGER NOT NULL REFERENCES library_policies(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    actor_type VARCHAR(40) NOT NULL,
    actor_id INTEGER,
    source_version INTEGER,
    target_version INTEGER,
    reason_code VARCHAR(80) NOT NULL,
    summary TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_intent_migration_events_event_type_chk CHECK (
        event_type IN (
            'dry_run_reported',
            'conversion_started',
            'conversion_applied',
            'conversion_failed',
            'rollback_snapshot_created',
            'rollback_applied',
            'native_validated',
            'legacy_deletion_ready'
        )
    ),
    CONSTRAINT policy_intent_migration_events_actor_type_chk CHECK (
        actor_type IN ('operator', 'post_upgrade', 'test_fixture', 'maintainer')
    ),
    CONSTRAINT policy_intent_migration_events_metadata_shape_chk CHECK (
        jsonb_typeof(metadata) = 'object'
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_intent_migration_events_state
    ON policy_intent_migration_events (policy_id, event_type, created_at);

CREATE TABLE IF NOT EXISTS policy_intent_rollback_snapshots (
    id BIGSERIAL PRIMARY KEY,
    intent_id BIGINT NOT NULL REFERENCES policy_intents(id) ON DELETE CASCADE,
    policy_id INTEGER NOT NULL REFERENCES library_policies(id) ON DELETE CASCADE,
    snapshot_version INTEGER NOT NULL,
    snapshot_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    payload_redacted BOOLEAN NOT NULL DEFAULT TRUE,
    restore_path TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    restored_at TIMESTAMPTZ,
    CONSTRAINT policy_intent_rollback_snapshots_version_chk CHECK (snapshot_version > 0),
    CONSTRAINT policy_intent_rollback_snapshots_payload_shape_chk CHECK (
        jsonb_typeof(snapshot_payload) = 'object'
    ),
    CONSTRAINT policy_intent_rollback_snapshots_window_chk CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_policy_intent_rollback_snapshots_expiry
    ON policy_intent_rollback_snapshots (policy_id, expires_at);

CREATE TABLE IF NOT EXISTS policy_intent_validation_status (
    id BIGSERIAL PRIMARY KEY,
    intent_id BIGINT NOT NULL REFERENCES policy_intents(id) ON DELETE CASCADE,
    schema_version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(40) NOT NULL,
    validator_version VARCHAR(80) NOT NULL,
    error_count INTEGER NOT NULL DEFAULT 0,
    warning_count INTEGER NOT NULL DEFAULT 0,
    errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_intent_validation_status_schema_version_chk CHECK (schema_version = 1),
    CONSTRAINT policy_intent_validation_status_status_chk CHECK (
        status IN ('valid', 'invalid', 'warning')
    ),
    CONSTRAINT policy_intent_validation_status_error_count_chk CHECK (error_count >= 0),
    CONSTRAINT policy_intent_validation_status_warning_count_chk CHECK (warning_count >= 0),
    CONSTRAINT policy_intent_validation_status_errors_shape_chk CHECK (
        jsonb_typeof(errors) = 'array'
    ),
    CONSTRAINT policy_intent_validation_status_warnings_shape_chk CHECK (
        jsonb_typeof(warnings) = 'array'
    )
);

CREATE INDEX IF NOT EXISTS idx_policy_intent_validation_status_lookup
    ON policy_intent_validation_status (intent_id, status, validated_at);
