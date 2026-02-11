-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Migration: add rag loop governance config
-- Created: 2026-02-11T09:01:00.000Z
-- Purpose:
--   Add rollout gate, trace, learning, alias, and resilience controls.

INSERT INTO ai_provider_config (id, primary_provider)
SELECT 1, 'none'
WHERE NOT EXISTS (
  SELECT 1 FROM ai_provider_config WHERE id = 1
);

ALTER TABLE ai_provider_config
  ADD COLUMN IF NOT EXISTS rag_loop_shadow_min_samples INTEGER DEFAULT 200,
  ADD COLUMN IF NOT EXISTS rag_loop_shadow_max_error_rate_delta NUMERIC(5,4) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS rag_loop_shadow_max_p95_latency_delta_ms INTEGER DEFAULT 250,
  ADD COLUMN IF NOT EXISTS rag_loop_trace_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS rag_loop_trace_max_events INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS rag_loop_trace_max_bytes INTEGER DEFAULT 16384,
  ADD COLUMN IF NOT EXISTS rag_loop_trace_include_stage_metrics BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS policy_learning_second_pass_requires_manual_confirmation BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS policy_learning_include_shadow_feedback BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS policy_learning_allow_machine_only_second_pass_feedback BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rag_alias_expansion_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS rag_alias_max_terms INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS rag_alias_min_token_length INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS rag_alias_source_policy VARCHAR(30) DEFAULT 'authoritative_only',
  ADD COLUMN IF NOT EXISTS rag_title_precedence_mode VARCHAR(30) DEFAULT 'canonical_first',
  ADD COLUMN IF NOT EXISTS rag_alias_weight NUMERIC(4,2) DEFAULT 0.60,
  ADD COLUMN IF NOT EXISTS rag_loop_resilience_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS rag_loop_resilience_window_ms INTEGER DEFAULT 300000,
  ADD COLUMN IF NOT EXISTS rag_loop_resilience_min_samples INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS rag_loop_resilience_timeout_streak_threshold INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS rag_loop_resilience_timeout_rate_threshold NUMERIC(4,2) DEFAULT 0.35,
  ADD COLUMN IF NOT EXISTS rag_loop_resilience_error_rate_threshold NUMERIC(4,2) DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS rag_loop_cooldown_tmdb_ms INTEGER DEFAULT 900000,
  ADD COLUMN IF NOT EXISTS rag_loop_cooldown_rag_ms INTEGER DEFAULT 600000,
  ADD COLUMN IF NOT EXISTS rag_loop_cooldown_ai_ms INTEGER DEFAULT 900000,
  ADD COLUMN IF NOT EXISTS rag_loop_half_open_probe_count INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS rag_loop_global_bypass_multi_open_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS rag_loop_global_bypass_ms INTEGER DEFAULT 600000;

UPDATE ai_provider_config
SET
  rag_loop_shadow_min_samples = LEAST(1000000, GREATEST(1, COALESCE(rag_loop_shadow_min_samples, 200))),
  rag_loop_shadow_max_error_rate_delta = LEAST(1.0000, GREATEST(0.0000, COALESCE(rag_loop_shadow_max_error_rate_delta, 0.01))),
  rag_loop_shadow_max_p95_latency_delta_ms = LEAST(600000, GREATEST(0, COALESCE(rag_loop_shadow_max_p95_latency_delta_ms, 250))),
  rag_loop_trace_max_events = LEAST(200, GREATEST(1, COALESCE(rag_loop_trace_max_events, 20))),
  rag_loop_trace_max_bytes = LEAST(131072, GREATEST(256, COALESCE(rag_loop_trace_max_bytes, 16384))),
  rag_alias_max_terms = LEAST(20, GREATEST(1, COALESCE(rag_alias_max_terms, 5))),
  rag_alias_min_token_length = LEAST(10, GREATEST(1, COALESCE(rag_alias_min_token_length, 3))),
  rag_alias_source_policy = CASE
    WHEN rag_alias_source_policy = 'authoritative_only' THEN rag_alias_source_policy
    ELSE 'authoritative_only'
  END,
  rag_title_precedence_mode = CASE
    WHEN rag_title_precedence_mode = 'canonical_first' THEN rag_title_precedence_mode
    ELSE 'canonical_first'
  END,
  rag_alias_weight = LEAST(1.00, GREATEST(0.00, COALESCE(rag_alias_weight, 0.60))),
  rag_loop_resilience_window_ms = LEAST(3600000, GREATEST(1000, COALESCE(rag_loop_resilience_window_ms, 300000))),
  rag_loop_resilience_min_samples = LEAST(10000, GREATEST(1, COALESCE(rag_loop_resilience_min_samples, 20))),
  rag_loop_resilience_timeout_streak_threshold = LEAST(20, GREATEST(1, COALESCE(rag_loop_resilience_timeout_streak_threshold, 3))),
  rag_loop_resilience_timeout_rate_threshold = LEAST(1.00, GREATEST(0.00, COALESCE(rag_loop_resilience_timeout_rate_threshold, 0.35))),
  rag_loop_resilience_error_rate_threshold = LEAST(1.00, GREATEST(0.00, COALESCE(rag_loop_resilience_error_rate_threshold, 0.50))),
  rag_loop_cooldown_tmdb_ms = LEAST(86400000, GREATEST(0, COALESCE(rag_loop_cooldown_tmdb_ms, 900000))),
  rag_loop_cooldown_rag_ms = LEAST(86400000, GREATEST(0, COALESCE(rag_loop_cooldown_rag_ms, 600000))),
  rag_loop_cooldown_ai_ms = LEAST(86400000, GREATEST(0, COALESCE(rag_loop_cooldown_ai_ms, 900000))),
  rag_loop_half_open_probe_count = LEAST(20, GREATEST(1, COALESCE(rag_loop_half_open_probe_count, 2))),
  rag_loop_global_bypass_ms = LEAST(86400000, GREATEST(0, COALESCE(rag_loop_global_bypass_ms, 600000)));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_shadow_min_samples_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_shadow_min_samples_chk
      CHECK (rag_loop_shadow_min_samples BETWEEN 1 AND 1000000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_shadow_err_delta_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_shadow_err_delta_chk
      CHECK (rag_loop_shadow_max_error_rate_delta BETWEEN 0.0000 AND 1.0000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_shadow_p95_delta_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_shadow_p95_delta_chk
      CHECK (rag_loop_shadow_max_p95_latency_delta_ms BETWEEN 0 AND 600000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_trace_max_events_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_trace_max_events_chk
      CHECK (rag_loop_trace_max_events BETWEEN 1 AND 200);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_trace_max_bytes_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_trace_max_bytes_chk
      CHECK (rag_loop_trace_max_bytes BETWEEN 256 AND 131072);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_alias_max_terms_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_alias_max_terms_chk
      CHECK (rag_alias_max_terms BETWEEN 1 AND 20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_alias_min_token_len_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_alias_min_token_len_chk
      CHECK (rag_alias_min_token_length BETWEEN 1 AND 10);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_alias_source_policy_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_alias_source_policy_chk
      CHECK (rag_alias_source_policy = 'authoritative_only');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_title_precedence_mode_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_title_precedence_mode_chk
      CHECK (rag_title_precedence_mode = 'canonical_first');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_alias_weight_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_alias_weight_chk
      CHECK (rag_alias_weight BETWEEN 0.00 AND 1.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_resilience_window_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_resilience_window_chk
      CHECK (rag_loop_resilience_window_ms BETWEEN 1000 AND 3600000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_resilience_min_samples_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_resilience_min_samples_chk
      CHECK (rag_loop_resilience_min_samples BETWEEN 1 AND 10000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_resilience_timeout_streak_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_resilience_timeout_streak_chk
      CHECK (rag_loop_resilience_timeout_streak_threshold BETWEEN 1 AND 20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_resilience_timeout_rate_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_resilience_timeout_rate_chk
      CHECK (rag_loop_resilience_timeout_rate_threshold BETWEEN 0.00 AND 1.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_resilience_error_rate_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_resilience_error_rate_chk
      CHECK (rag_loop_resilience_error_rate_threshold BETWEEN 0.00 AND 1.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_cooldown_tmdb_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_cooldown_tmdb_chk
      CHECK (rag_loop_cooldown_tmdb_ms BETWEEN 0 AND 86400000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_cooldown_rag_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_cooldown_rag_chk
      CHECK (rag_loop_cooldown_rag_ms BETWEEN 0 AND 86400000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_cooldown_ai_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_cooldown_ai_chk
      CHECK (rag_loop_cooldown_ai_ms BETWEEN 0 AND 86400000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_half_open_probe_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_half_open_probe_chk
      CHECK (rag_loop_half_open_probe_count BETWEEN 1 AND 20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_global_bypass_ms_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_global_bypass_ms_chk
      CHECK (rag_loop_global_bypass_ms BETWEEN 0 AND 86400000);
  END IF;
END $$;

COMMENT ON COLUMN ai_provider_config.rag_loop_shadow_min_samples IS 'Minimum shadow sample size required before apply promotion.';
COMMENT ON COLUMN ai_provider_config.rag_loop_shadow_max_error_rate_delta IS 'Maximum allowed error-rate delta for promotion gate.';
COMMENT ON COLUMN ai_provider_config.rag_loop_shadow_max_p95_latency_delta_ms IS 'Maximum allowed p95 latency delta for promotion gate.';
COMMENT ON COLUMN ai_provider_config.rag_loop_trace_enabled IS 'Enable rag loop trace persistence in classification metadata.';
COMMENT ON COLUMN ai_provider_config.rag_loop_trace_max_events IS 'Maximum events/stages preserved in rag loop trace payload.';
COMMENT ON COLUMN ai_provider_config.rag_loop_trace_max_bytes IS 'Maximum serialized size of rag loop trace payload.';
COMMENT ON COLUMN ai_provider_config.rag_loop_trace_include_stage_metrics IS 'Include stage metrics in rag loop trace payload.';
COMMENT ON COLUMN ai_provider_config.policy_learning_second_pass_requires_manual_confirmation IS 'Require manual confirmation before learning from second-pass applied outcomes.';
COMMENT ON COLUMN ai_provider_config.policy_learning_include_shadow_feedback IS 'Allow shadow-only outcomes to participate in learning.';
COMMENT ON COLUMN ai_provider_config.policy_learning_allow_machine_only_second_pass_feedback IS 'Allow machine-only pass2 outcomes to update learning artifacts.';
COMMENT ON COLUMN ai_provider_config.rag_alias_expansion_enabled IS 'Enable authoritative alias expansion in second-pass retrieval text.';
COMMENT ON COLUMN ai_provider_config.rag_alias_max_terms IS 'Maximum alias terms allowed in second-pass expansion.';
COMMENT ON COLUMN ai_provider_config.rag_alias_min_token_length IS 'Minimum alias token length for non-CJK scripts.';
COMMENT ON COLUMN ai_provider_config.rag_alias_source_policy IS 'Alias source policy for retrieval expansion.';
COMMENT ON COLUMN ai_provider_config.rag_title_precedence_mode IS 'Title precedence mode for canonical/original/alias handling.';
COMMENT ON COLUMN ai_provider_config.rag_alias_weight IS 'Relative retrieval weight applied to alias terms.';
COMMENT ON COLUMN ai_provider_config.rag_loop_resilience_enabled IS 'Enable resilience cooldown controls for optional second-pass stages.';
COMMENT ON COLUMN ai_provider_config.rag_loop_resilience_window_ms IS 'Rolling window used by resilience breaker statistics.';
COMMENT ON COLUMN ai_provider_config.rag_loop_resilience_min_samples IS 'Minimum sample size before resilience breaker triggers are evaluated.';
COMMENT ON COLUMN ai_provider_config.rag_loop_resilience_timeout_streak_threshold IS 'Consecutive timeout count needed to open breaker.';
COMMENT ON COLUMN ai_provider_config.rag_loop_resilience_timeout_rate_threshold IS 'Timeout-rate threshold to open breaker.';
COMMENT ON COLUMN ai_provider_config.rag_loop_resilience_error_rate_threshold IS 'Non-timeout error-rate threshold to open breaker.';
COMMENT ON COLUMN ai_provider_config.rag_loop_cooldown_tmdb_ms IS 'Cooldown duration for tmdb enrichment breaker.';
COMMENT ON COLUMN ai_provider_config.rag_loop_cooldown_rag_ms IS 'Cooldown duration for rag pass2 breaker.';
COMMENT ON COLUMN ai_provider_config.rag_loop_cooldown_ai_ms IS 'Cooldown duration for ai rerun breaker.';
COMMENT ON COLUMN ai_provider_config.rag_loop_half_open_probe_count IS 'Probe count required for half-open breaker recovery.';
COMMENT ON COLUMN ai_provider_config.rag_loop_global_bypass_multi_open_enabled IS 'Enable global second-pass bypass when multiple breakers are open.';
COMMENT ON COLUMN ai_provider_config.rag_loop_global_bypass_ms IS 'Duration of global bypass when multi-breaker protection is activated.';
