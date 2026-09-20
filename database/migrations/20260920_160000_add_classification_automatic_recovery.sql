-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Server-owned retry provenance. Payload/metadata never supplies these values.
ALTER TABLE classification_history
    ADD COLUMN IF NOT EXISTS retry_failure_code text,
    ADD COLUMN IF NOT EXISTS retry_exhausted_at timestamptz,
    ADD COLUMN IF NOT EXISTS retry_recovery_attempts smallint NOT NULL DEFAULT 0
        CHECK (retry_recovery_attempts BETWEEN 0 AND 1);
ALTER TABLE task_queue
    ADD COLUMN IF NOT EXISTS classification_recovery_attempts smallint NOT NULL DEFAULT 0
        CHECK (classification_recovery_attempts BETWEEN 0 AND 1);

CREATE INDEX IF NOT EXISTS idx_classification_automatic_recovery_due
    ON classification_history (retry_exhausted_at, id)
    WHERE status = 'failed' AND method = 'queued_for_retry'
        AND library_id IS NULL AND retry_recovery_attempts = 0
        AND retry_failure_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS classification_recovery_probe_state (
    id boolean PRIMARY KEY DEFAULT true CHECK (id),
    next_probe_at timestamptz NOT NULL DEFAULT now(),
    lease_token uuid,
    checked_at timestamptz,
    last_outcome text CHECK (last_outcome IN ('ready', 'unavailable', 'configuration_changed'))
);
INSERT INTO classification_recovery_probe_state (id) VALUES (true)
    ON CONFLICT (id) DO NOTHING;
