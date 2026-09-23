-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Operational, count-only progress for diagnosing stalled profile recovery.
CREATE TABLE IF NOT EXISTS profile_refresh_worker_progress (
    singleton_id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (singleton_id = 1),
    last_tick_at TIMESTAMPTZ NOT NULL,
    last_success_at TIMESTAMPTZ,
    last_claimed_at TIMESTAMPTZ,
    last_completed_at TIMESTAMPTZ,
    last_outcome_id VARCHAR(24) NOT NULL CHECK (last_outcome_id IN ('completed', 'partial_failure', 'failed'))
);

-- Also converge a table supplied by an earlier in-development schema snapshot.
ALTER TABLE profile_refresh_worker_progress
    ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ;

COMMENT ON TABLE profile_refresh_worker_progress IS
    'Single operational worker progress row; no library, media, provider, or error payloads.';
