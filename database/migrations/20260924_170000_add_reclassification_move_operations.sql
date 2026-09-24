-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Intentionally no history/library FK: cleanup must not erase an unfinished move.
CREATE TABLE IF NOT EXISTS reclassification_move_operations (
    id uuid PRIMARY KEY,
    classification_id integer NOT NULL,
    target_library_id integer NOT NULL,
    resource_key text NOT NULL CHECK (length(resource_key) <= 120),
    plan jsonb NOT NULL CHECK (jsonb_typeof(plan) = 'object' AND octet_length(plan::text) <= 16384),
    corrected_by varchar(100) NOT NULL,
    state text NOT NULL DEFAULT 'moving'
        CHECK (state IN ('moving', 'files_verified', 'needs_attention', 'completed')),
    reason_code text CHECK (length(reason_code) <= 80),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 31),
    next_attempt_at timestamptz NOT NULL DEFAULT NOW(),
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    completed_at timestamptz,
    CHECK ((state = 'completed') = (completed_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reclassification_move_active_history
    ON reclassification_move_operations (classification_id) WHERE state <> 'completed';
CREATE UNIQUE INDEX IF NOT EXISTS idx_reclassification_move_active_resource
    ON reclassification_move_operations (resource_key) WHERE state <> 'completed';
CREATE INDEX IF NOT EXISTS idx_reclassification_move_due
    ON reclassification_move_operations (next_attempt_at, id) WHERE state IN ('moving', 'files_verified');
CREATE INDEX IF NOT EXISTS idx_reclassification_move_completed
    ON reclassification_move_operations (completed_at) WHERE state = 'completed';
CREATE INDEX IF NOT EXISTS idx_reclassification_move_history
    ON reclassification_move_operations (classification_id, created_at DESC);
