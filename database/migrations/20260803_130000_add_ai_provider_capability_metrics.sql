/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

-- This table records only aggregate provider capability counters. It never
-- stores prompts, model output, media metadata, identifiers, or actions.
CREATE TABLE IF NOT EXISTS ai_provider_capability_metrics (
    provider_id VARCHAR(32) NOT NULL,
    model VARCHAR(255) NOT NULL,
    authority_mode VARCHAR(32) NOT NULL,
    request_count BIGINT NOT NULL DEFAULT 0,
    structured_parse_success_count BIGINT NOT NULL DEFAULT 0,
    semantic_contract_violation_count BIGINT NOT NULL DEFAULT 0,
    repair_attempt_count BIGINT NOT NULL DEFAULT 0,
    repair_success_count BIGINT NOT NULL DEFAULT 0,
    timeout_or_incomplete_stream_count BIGINT NOT NULL DEFAULT 0,
    hallucinated_library_reference_count BIGINT NOT NULL DEFAULT 0,
    hallucinated_action_count BIGINT NOT NULL DEFAULT 0,
    thinking_trace_leakage_count BIGINT NOT NULL DEFAULT 0,
    last_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (provider_id, model, authority_mode),
    CONSTRAINT ai_provider_capability_metrics_provider_shape_chk CHECK (
        provider_id ~ '^[a-z0-9_-]{1,32}$'
    ),
    CONSTRAINT ai_provider_capability_metrics_model_shape_chk CHECK (
        length(btrim(model)) BETWEEN 1 AND 255
    ),
    CONSTRAINT ai_provider_capability_metrics_authority_mode_chk CHECK (
        authority_mode IN (
            'structured_contract',
            'verification',
            'proposal',
            'explanation',
            'fallback_advisory',
            'disabled'
        )
    ),
    CONSTRAINT ai_provider_capability_metrics_nonnegative_counts_chk CHECK (
        request_count >= 0
        AND structured_parse_success_count >= 0
        AND semantic_contract_violation_count >= 0
        AND repair_attempt_count >= 0
        AND repair_success_count >= 0
        AND timeout_or_incomplete_stream_count >= 0
        AND hallucinated_library_reference_count >= 0
        AND hallucinated_action_count >= 0
        AND thinking_trace_leakage_count >= 0
    )
);

COMMENT ON TABLE ai_provider_capability_metrics IS
    'Aggregate AI provider capability counters; no prompts, model output, media data, or actions.';
