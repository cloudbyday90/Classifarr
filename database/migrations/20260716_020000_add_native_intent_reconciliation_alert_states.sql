-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- Durable deduplication state for scheduler-driven native-intent reconciliation alerts.
-- Alert payloads remain in app_notifications; this table stores only bounded IDs,
-- timestamps, and counts so cooldowns survive process restarts.

CREATE TABLE policy_native_intent_reconciliation_alert_states (
    alert_type_id VARCHAR(80) PRIMARY KEY,
    alert_state VARCHAR(40) NOT NULL,
    first_detected_at TIMESTAMPTZ NOT NULL,
    last_detected_at TIMESTAMPTZ NOT NULL,
    last_notified_at TIMESTAMPTZ,
    last_resolved_at TIMESTAMPTZ,
    occurrence_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT policy_native_intent_reconciliation_alert_type_chk CHECK (
        alert_type_id ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'
    ),
    CONSTRAINT policy_native_intent_reconciliation_alert_state_chk CHECK (
        alert_state IN ('firing', 'resolved')
    ),
    CONSTRAINT policy_native_intent_reconciliation_alert_occurrence_count_chk CHECK (
        occurrence_count >= 0
    ),
    CONSTRAINT policy_native_intent_reconciliation_alert_time_order_chk CHECK (
        last_detected_at >= first_detected_at
        AND (last_notified_at IS NULL OR last_notified_at >= first_detected_at)
        AND (last_resolved_at IS NULL OR last_resolved_at >= first_detected_at)
    ),
    CONSTRAINT policy_native_intent_reconciliation_alert_resolution_shape_chk CHECK (
        (alert_state = 'firing' AND last_resolved_at IS NULL)
        OR (alert_state = 'resolved' AND last_resolved_at IS NOT NULL)
    )
);
