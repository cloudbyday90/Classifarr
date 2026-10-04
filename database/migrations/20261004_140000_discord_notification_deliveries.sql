-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- One initial Discord notification intent per classification, across presentations.
CREATE TABLE IF NOT EXISTS discord_notification_deliveries (
    classification_id BIGINT PRIMARY KEY REFERENCES classification_history(id) ON DELETE CASCADE,
    nonce VARCHAR(25) NOT NULL UNIQUE CHECK (nonce ~ '^cf_[A-Za-z0-9_-]{22}$'),
    bot_user_id VARCHAR(20) NOT NULL CHECK (bot_user_id ~ '^[0-9]{17,20}$'),
    channel_id VARCHAR(20) NOT NULL CHECK (channel_id ~ '^[0-9]{17,20}$'),
    notification_kind TEXT NOT NULL CHECK (notification_kind IN ('classification', 'confidence', 'pending')),
    state TEXT NOT NULL DEFAULT 'sending' CHECK (state IN ('sending', 'uncertain', 'rejected', 'delivered')),
    message_id VARCHAR(20) CHECK (message_id ~ '^[0-9]{17,20}$'),
    previous_status VARCHAR(20),
    previous_clarification_status VARCHAR(32),
    desired_clarification_status VARCHAR(32),
    failure_code TEXT CHECK (failure_code IN ('send_unconfirmed', 'provider_rejected', 'completion_unconfirmed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((state = 'delivered') = (message_id IS NOT NULL))
);
