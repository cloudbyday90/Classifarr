-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Fixed, coalesced scheduler execution aggregates. They intentionally retain
-- no task name, cron expression, error text, SQL, identifier, library,
-- provider, configuration, media, policy value, AI data, decision, or routing
-- data. A completed receipt means the handler returned; task-specific outcome
-- semantics remain in the existing bounded task contracts.
CREATE TABLE IF NOT EXISTS scheduler_execution_receipts (
    task_class VARCHAR(32) NOT NULL,
    outcome_id VARCHAR(32) NOT NULL,
    receipt_version VARCHAR(64) NOT NULL,
    duration_bucket VARCHAR(20) NOT NULL,
    observation_count BIGINT NOT NULL DEFAULT 0,
    last_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_class, outcome_id, receipt_version, duration_bucket),
    CONSTRAINT scheduler_execution_receipts_task_class_chk CHECK (
        task_class IN (
            'queue',
            'library_observation',
            'maintenance',
            'retention',
            'policy_maintenance',
            'observation',
            'other'
        )
    ),
    CONSTRAINT scheduler_execution_receipts_outcome_chk CHECK (
        outcome_id IN (
            'completed',
            'failed',
            'advisory_lock_held',
            'in_process_overlap',
            'cron_overlap'
        )
    ),
    CONSTRAINT scheduler_execution_receipts_duration_bucket_chk CHECK (
        duration_bucket IN (
            'not_sampled',
            'under_5ms',
            '5_to_24ms',
            '25_to_99ms',
            '100_to_499ms',
            '500ms_or_more'
        )
    ),
    CONSTRAINT scheduler_execution_receipts_duration_outcome_chk CHECK (
        (outcome_id IN ('completed', 'failed') AND duration_bucket <> 'not_sampled')
        OR (outcome_id NOT IN ('completed', 'failed') AND duration_bucket = 'not_sampled')
    ),
    CONSTRAINT scheduler_execution_receipts_observation_count_chk CHECK (
        observation_count > 0
    )
);

COMMENT ON TABLE scheduler_execution_receipts IS
    'Fixed aggregate scheduler execution counters; no task name, schedule, error, SQL, identifier, library, provider, configuration, media, policy, AI, decision, or routing data.';
