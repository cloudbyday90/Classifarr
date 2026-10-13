-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Enrollment is bounded at runtime. No provider calls, retries or ID changes here.
CREATE TABLE IF NOT EXISTS queue_metadata_recovery (
    task_id bigint PRIMARY KEY REFERENCES task_queue(id) ON DELETE CASCADE,
    probe_count smallint NOT NULL DEFAULT 0 CHECK (probe_count BETWEEN 0 AND 6),
    next_probe_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '1 hour'),
    lease_token uuid,
    last_outcome text,
    checked_at timestamptz,
    recovered_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_queue_metadata_recovery_due
    ON queue_metadata_recovery(next_probe_at, task_id)
    WHERE recovered_at IS NULL AND probe_count < 6;
