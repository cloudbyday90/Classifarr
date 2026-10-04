-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE IF NOT EXISTS discord_delivery_verification_guard (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    operation_id uuid NOT NULL,
    classification_id bigint NOT NULL,
    next_allowed_at timestamptz NOT NULL,
    outcome text NOT NULL CHECK (outcome IN (
        'started', 'confirmed', 'configuration_changed', 'cancelled', 'rate_limited',
        'access_denied', 'message_unavailable', 'provider_unavailable', 'bot_changed',
        'proof_mismatch', 'timed_out', 'verification_unavailable'
    )),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
