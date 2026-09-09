-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Fixed, process-local event-loop delay aggregates. They retain no raw delay,
-- sample count, process identity, task, SQL, identifier, media, library,
-- provider, configuration, policy, AI data, decision, error, or routing data.
CREATE TABLE IF NOT EXISTS event_loop_delay_receipts (
    receipt_version VARCHAR(64) NOT NULL,
    p99_delay_bucket VARCHAR(20) NOT NULL,
    observation_count BIGINT NOT NULL DEFAULT 0,
    last_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (receipt_version, p99_delay_bucket),
    CONSTRAINT event_loop_delay_receipts_version_chk CHECK (
        receipt_version = 'event_loop.delay_receipt.v1'
    ),
    CONSTRAINT event_loop_delay_receipts_p99_delay_bucket_chk CHECK (
        p99_delay_bucket IN (
            'unavailable',
            'under_25ms',
            '25_to_49ms',
            '50_to_99ms',
            '100_to_499ms',
            '500ms_or_more'
        )
    ),
    CONSTRAINT event_loop_delay_receipts_observation_count_chk CHECK (
        observation_count > 0
    )
);

COMMENT ON TABLE event_loop_delay_receipts IS
    'Fixed aggregate process event-loop delay counters; no raw timing, sample count, process, task, SQL, identifier, media, library, provider, configuration, policy, AI, decision, error, or routing data.';
