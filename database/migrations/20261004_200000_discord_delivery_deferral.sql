-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE IF NOT EXISTS discord_provider_cooldown (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    next_allowed_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE discord_notification_deliveries
    ADD COLUMN IF NOT EXISTS attempt_count smallint NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 3),
    ADD COLUMN IF NOT EXISTS config_fingerprint text CHECK (config_fingerprint ~ '^[0-9a-f]{64}$');
ALTER TABLE discord_notification_deliveries DROP CONSTRAINT IF EXISTS discord_notification_deliveries_state_check;
ALTER TABLE discord_notification_deliveries ADD CONSTRAINT discord_notification_deliveries_state_check
    CHECK (state IN ('sending', 'uncertain', 'rejected', 'delivered', 'deferred'));
ALTER TABLE discord_notification_deliveries DROP CONSTRAINT IF EXISTS discord_notification_deliveries_failure_code_check;
ALTER TABLE discord_notification_deliveries ADD CONSTRAINT discord_notification_deliveries_failure_code_check
    CHECK (failure_code IN ('send_unconfirmed', 'provider_rejected', 'completion_unconfirmed', 'provider_rate_limited'));
