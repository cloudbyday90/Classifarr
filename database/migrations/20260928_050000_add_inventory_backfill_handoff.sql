-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- A completed ingestion run is unacknowledged until its bounded enqueue pass commits.
-- NULL deliberately makes existing completed runs eligible for conservative adoption.
ALTER TABLE library_ingestion_state
    ADD COLUMN IF NOT EXISTS backfill_run_id uuid,
    ADD COLUMN IF NOT EXISTS backfill_after_id integer NOT NULL DEFAULT 0 CHECK (backfill_after_id >= 0),
    ADD COLUMN IF NOT EXISTS backfill_through_id integer CHECK (backfill_through_id >= 0),
    ADD COLUMN IF NOT EXISTS backfill_completed_at timestamptz,
    ADD COLUMN IF NOT EXISTS backfill_updated_at timestamptz;
