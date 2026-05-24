-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Migration: Persist policy overlap metrics snapshots
-- Purpose:
-- 1. Preserve overlap telemetry across process restarts
-- 2. Keep a low-volume history of weak-evidence policy outcomes
-- 3. Support operator trend analysis without scanning classification history JSON

CREATE TABLE IF NOT EXISTS policy_overlap_metrics_snapshots (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL,
    session_started_at TIMESTAMPTZ NOT NULL,
    snapshot_reason VARCHAR(64) NOT NULL DEFAULT 'periodic',
    decision_delta INTEGER NOT NULL DEFAULT 0,
    total_decisions INTEGER NOT NULL DEFAULT 0,
    weak_evidence_primary_count INTEGER NOT NULL DEFAULT 0,
    weak_evidence_overlap_count INTEGER NOT NULL DEFAULT 0,
    manual_review_recommended_count INTEGER NOT NULL DEFAULT 0,
    actions JSONB NOT NULL DEFAULT '{}'::jsonb,
    primary_viability_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    top_overlap_pairs JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_overlap_metrics_snapshots_created_at
    ON policy_overlap_metrics_snapshots (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_policy_overlap_metrics_snapshots_session_id
    ON policy_overlap_metrics_snapshots (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_policy_overlap_metrics_snapshots_reason
    ON policy_overlap_metrics_snapshots (snapshot_reason, created_at DESC);

COMMENT ON TABLE policy_overlap_metrics_snapshots IS
    'Periodic persisted snapshots of aggregate policy overlap telemetry, including weak-evidence routing signals.';

COMMENT ON COLUMN policy_overlap_metrics_snapshots.session_id IS
    'Runtime collector session identifier so cumulative counters can be segmented across restarts.';

COMMENT ON COLUMN policy_overlap_metrics_snapshots.snapshot_reason IS
    'Reason the snapshot was persisted, such as decision_recorded or manual_flush.';

COMMENT ON COLUMN policy_overlap_metrics_snapshots.decision_delta IS
    'Number of new policy decisions observed since the previous persisted snapshot for this process.';
