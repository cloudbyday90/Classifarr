-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Additive and empty on upgrade; no background work is enrolled.
CREATE TABLE IF NOT EXISTS manual_routing_provider_state (
    radarr_id integer UNIQUE REFERENCES radarr_config(id) ON DELETE CASCADE,
    sonarr_id integer UNIQUE REFERENCES sonarr_config(id) ON DELETE CASCADE,
    revision varchar(64) NOT NULL CHECK (revision ~ '^[a-f0-9]{64}$'),
    reservation_id uuid,
    failures integer NOT NULL DEFAULT 0 CHECK (failures BETWEEN 0 AND 16),
    reason text CHECK (reason IN ('provider_paused', 'provider_auth_required', 'provider_configuration_required')),
    next_check_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    CHECK (num_nonnulls(radarr_id, sonarr_id) = 1)
);
