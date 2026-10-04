-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Empty on upgrade. Only explicit preset creation reserves work.
CREATE TABLE custom_preset_save_requests (
    id uuid PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'saved', 'cancelled')),
    fingerprint varchar(64) CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
    preset_id integer REFERENCES content_presets(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    resolved_at timestamptz,
    CHECK ((state = 'saved' AND fingerprint IS NOT NULL) OR
           (state <> 'saved' AND fingerprint IS NULL AND preset_id IS NULL)),
    CHECK (state <> 'cancelled' OR resolved_at IS NOT NULL),
    CHECK (state <> 'pending' OR resolved_at IS NULL)
);
CREATE UNIQUE INDEX custom_preset_save_requests_unresolved_user
    ON custom_preset_save_requests (user_id) WHERE resolved_at IS NULL;
CREATE INDEX custom_preset_save_requests_retention
    ON custom_preset_save_requests (user_id, resolved_at) WHERE resolved_at IS NOT NULL;
