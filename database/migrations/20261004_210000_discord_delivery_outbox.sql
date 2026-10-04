-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE IF NOT EXISTS discord_delivery_outbox (
    nonce text PRIMARY KEY REFERENCES discord_notification_deliveries(nonce) ON DELETE CASCADE,
    config_id integer NOT NULL REFERENCES notification_config(id) ON DELETE CASCADE,
    body text NOT NULL CHECK (octet_length(body) <= 65536),
    expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS discord_delivery_outbox_expiry_idx ON discord_delivery_outbox (expires_at);
