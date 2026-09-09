-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

-- Queue startup performance receipts are fixed aggregate counters only.
-- They retain no SQL, duration, item/library/provider/configuration identifier,
-- media content, error text, decision, policy, AI, or routing data.
CREATE TABLE IF NOT EXISTS queue_startup_performance_receipts (
    operation_id VARCHAR(32) NOT NULL,
    receipt_version VARCHAR(64) NOT NULL,
    duration_bucket VARCHAR(20) NOT NULL,
    scanned_id_bucket VARCHAR(20) NOT NULL,
    candidate_count_bucket VARCHAR(20) NOT NULL,
    buffer_bucket VARCHAR(20) NOT NULL,
    observation_count BIGINT NOT NULL DEFAULT 0,
    last_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (
        operation_id,
        receipt_version,
        duration_bucket,
        scanned_id_bucket,
        candidate_count_bucket,
        buffer_bucket
    ),
    CONSTRAINT queue_startup_performance_receipts_operation_chk CHECK (
        operation_id IN ('queue_worker_health', 'queue_refill_candidates')
    ),
    CONSTRAINT queue_startup_performance_receipts_duration_bucket_chk CHECK (
        duration_bucket IN ('unavailable', 'under_5ms', '5_to_24ms', '25_to_99ms', '100_to_499ms', '500ms_or_more')
    ),
    CONSTRAINT queue_startup_performance_receipts_count_bucket_chk CHECK (
        scanned_id_bucket IN ('not_applicable', 'zero', '1_to_99', '100_to_999', '1000_to_4999', '5000_or_more')
        AND candidate_count_bucket IN ('not_applicable', 'zero', '1_to_99', '100_to_999', '1000_to_4999', '5000_or_more')
    ),
    CONSTRAINT queue_startup_performance_receipts_buffer_bucket_chk CHECK (
        buffer_bucket = 'not_sampled'
    ),
    CONSTRAINT queue_startup_performance_receipts_observation_count_chk CHECK (
        observation_count > 0
    )
);

COMMENT ON TABLE queue_startup_performance_receipts IS
    'Fixed aggregate queue-startup performance counters; no query text, buffer plan, media, library, provider, configuration, policy, AI, or routing data.';
