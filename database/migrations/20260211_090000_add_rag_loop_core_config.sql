-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Migration: add rag loop core config
-- Created: 2026-02-11T09:00:00.000Z
-- Purpose:
--   Add second-pass core controls and policy re-check controls to ai_provider_config.

-- Ensure the singleton config row exists for upgrades with partial legacy state.
INSERT INTO ai_provider_config (id, primary_provider)
SELECT 1, 'none'
WHERE NOT EXISTS (
  SELECT 1 FROM ai_provider_config WHERE id = 1
);

ALTER TABLE ai_provider_config
  ADD COLUMN IF NOT EXISTS rag_retrieval_loop_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rag_loop_rollout_mode VARCHAR(10) DEFAULT 'shadow',
  ADD COLUMN IF NOT EXISTS rag_loop_low_confidence_threshold INTEGER DEFAULT 70,
  ADD COLUMN IF NOT EXISTS rag_loop_max_passes INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS rag_loop_use_hybrid_on_retry BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS rag_loop_conflict_detection_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rag_retry_strategy VARCHAR(20) DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS rag_retry_low_signal_similarity_floor NUMERIC(4,2) DEFAULT 0.55,
  ADD COLUMN IF NOT EXISTS rag_retry_conflict_semantic_preferred BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS rag_retry_sparse_metadata_prefers_hybrid BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS rag_loop_candidate_limit INTEGER DEFAULT 25,
  ADD COLUMN IF NOT EXISTS rag_conflict_top_n INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS rag_conflict_min_matches INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS rag_conflict_min_votes_per_library INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS rag_conflict_max_vote_gap INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rag_conflict_max_similarity_margin_ratio NUMERIC(4,2) DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS rag_conflict_min_avg_similarity NUMERIC(4,2) DEFAULT 0.55,
  ADD COLUMN IF NOT EXISTS policy_recheck_below_prompt_threshold_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS policy_recheck_max_attempts INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS policy_recheck_identifier_caps JSONB DEFAULT '{"keywords":8,"genres":5,"studios":3,"cast":3}'::jsonb,
  ADD COLUMN IF NOT EXISTS policy_recheck_min_similarity_delta NUMERIC(4,2) DEFAULT 0.08,
  ADD COLUMN IF NOT EXISTS policy_recheck_min_margin_delta NUMERIC(6,2) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS policy_recheck_min_confidence_gain NUMERIC(6,2) DEFAULT 5,
  ADD COLUMN IF NOT EXISTS policy_recheck_max_ai_calls_per_item INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS policy_recheck_metadata_enrichment_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS policy_recheck_metadata_missing_fields_min INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS policy_recheck_metadata_timeout_ms INTEGER DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS policy_recheck_metadata_max_attempts INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS policy_recheck_metadata_source VARCHAR(30) DEFAULT 'authoritative_only';

-- Normalize existing values before applying constraints.
UPDATE ai_provider_config
SET
  rag_loop_rollout_mode = CASE
    WHEN rag_loop_rollout_mode IN ('shadow', 'apply') THEN rag_loop_rollout_mode
    ELSE 'shadow'
  END,
  rag_loop_low_confidence_threshold = LEAST(100, GREATEST(0, COALESCE(rag_loop_low_confidence_threshold, 70))),
  rag_loop_max_passes = LEAST(2, GREATEST(1, COALESCE(rag_loop_max_passes, 2))),
  rag_retry_strategy = CASE
    WHEN rag_retry_strategy IN ('auto', 'hybrid', 'semantic') THEN rag_retry_strategy
    ELSE 'auto'
  END,
  rag_retry_low_signal_similarity_floor = LEAST(1.00, GREATEST(0.00, COALESCE(rag_retry_low_signal_similarity_floor, 0.55))),
  rag_loop_candidate_limit = LEAST(100, GREATEST(1, COALESCE(rag_loop_candidate_limit, 25))),
  rag_conflict_top_n = LEAST(50, GREATEST(1, COALESCE(rag_conflict_top_n, 5))),
  rag_conflict_min_matches = LEAST(50, GREATEST(1, COALESCE(rag_conflict_min_matches, 3))),
  rag_conflict_min_votes_per_library = LEAST(10, GREATEST(1, COALESCE(rag_conflict_min_votes_per_library, 2))),
  rag_conflict_max_vote_gap = LEAST(10, GREATEST(0, COALESCE(rag_conflict_max_vote_gap, 1))),
  rag_conflict_max_similarity_margin_ratio = LEAST(1.00, GREATEST(0.00, COALESCE(rag_conflict_max_similarity_margin_ratio, 0.10))),
  rag_conflict_min_avg_similarity = LEAST(1.00, GREATEST(0.00, COALESCE(rag_conflict_min_avg_similarity, 0.55))),
  policy_recheck_max_attempts = LEAST(5, GREATEST(0, COALESCE(policy_recheck_max_attempts, 1))),
  policy_recheck_identifier_caps = jsonb_build_object(
    'keywords',
      LEAST(
        25,
        GREATEST(
          0,
          COALESCE(
            CASE
              WHEN (policy_recheck_identifier_caps ->> 'keywords') ~ '^\d+$'
                THEN (policy_recheck_identifier_caps ->> 'keywords')::INTEGER
              ELSE NULL
            END,
            8
          )
        )
      ),
    'genres',
      LEAST(
        25,
        GREATEST(
          0,
          COALESCE(
            CASE
              WHEN (policy_recheck_identifier_caps ->> 'genres') ~ '^\d+$'
                THEN (policy_recheck_identifier_caps ->> 'genres')::INTEGER
              ELSE NULL
            END,
            5
          )
        )
      ),
    'studios',
      LEAST(
        25,
        GREATEST(
          0,
          COALESCE(
            CASE
              WHEN (policy_recheck_identifier_caps ->> 'studios') ~ '^\d+$'
                THEN (policy_recheck_identifier_caps ->> 'studios')::INTEGER
              ELSE NULL
            END,
            3
          )
        )
      ),
    'cast',
      LEAST(
        25,
        GREATEST(
          0,
          COALESCE(
            CASE
              WHEN (policy_recheck_identifier_caps ->> 'cast') ~ '^\d+$'
                THEN (policy_recheck_identifier_caps ->> 'cast')::INTEGER
              ELSE NULL
            END,
            3
          )
        )
      )
  ),
  policy_recheck_min_similarity_delta = LEAST(1.00, GREATEST(0.00, COALESCE(policy_recheck_min_similarity_delta, 0.08))),
  policy_recheck_min_margin_delta = LEAST(100.00, GREATEST(0.00, COALESCE(policy_recheck_min_margin_delta, 10))),
  policy_recheck_min_confidence_gain = LEAST(100.00, GREATEST(0.00, COALESCE(policy_recheck_min_confidence_gain, 5))),
  policy_recheck_max_ai_calls_per_item = LEAST(5, GREATEST(1, COALESCE(policy_recheck_max_ai_calls_per_item, 2))),
  policy_recheck_metadata_missing_fields_min = LEAST(10, GREATEST(0, COALESCE(policy_recheck_metadata_missing_fields_min, 2))),
  policy_recheck_metadata_timeout_ms = LEAST(30000, GREATEST(100, COALESCE(policy_recheck_metadata_timeout_ms, 2000))),
  policy_recheck_metadata_max_attempts = LEAST(5, GREATEST(0, COALESCE(policy_recheck_metadata_max_attempts, 1))),
  policy_recheck_metadata_source = CASE
    WHEN policy_recheck_metadata_source = 'authoritative_only' THEN policy_recheck_metadata_source
    ELSE 'authoritative_only'
  END;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_rag_loop_mode_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_rag_loop_mode_chk
      CHECK (rag_loop_rollout_mode IN ('shadow', 'apply'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_rag_low_conf_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_rag_low_conf_chk
      CHECK (rag_loop_low_confidence_threshold BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_rag_max_pass_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_rag_max_pass_chk
      CHECK (rag_loop_max_passes BETWEEN 1 AND 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_rag_retry_strategy_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_rag_retry_strategy_chk
      CHECK (rag_retry_strategy IN ('auto', 'hybrid', 'semantic'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_rag_retry_low_signal_floor_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_rag_retry_low_signal_floor_chk
      CHECK (rag_retry_low_signal_similarity_floor BETWEEN 0.00 AND 1.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_rag_candidate_limit_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_rag_candidate_limit_chk
      CHECK (rag_loop_candidate_limit BETWEEN 1 AND 100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_rag_conflict_top_n_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_rag_conflict_top_n_chk
      CHECK (rag_conflict_top_n BETWEEN 1 AND 50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_rag_conflict_min_matches_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_rag_conflict_min_matches_chk
      CHECK (rag_conflict_min_matches BETWEEN 1 AND 50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_rag_conflict_min_votes_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_rag_conflict_min_votes_chk
      CHECK (rag_conflict_min_votes_per_library BETWEEN 1 AND 10);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_rag_conflict_vote_gap_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_rag_conflict_vote_gap_chk
      CHECK (rag_conflict_max_vote_gap BETWEEN 0 AND 10);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_rag_conflict_margin_ratio_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_rag_conflict_margin_ratio_chk
      CHECK (rag_conflict_max_similarity_margin_ratio BETWEEN 0.00 AND 1.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_rag_conflict_min_avg_sim_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_rag_conflict_min_avg_sim_chk
      CHECK (rag_conflict_min_avg_similarity BETWEEN 0.00 AND 1.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_policy_recheck_attempts_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_policy_recheck_attempts_chk
      CHECK (policy_recheck_max_attempts BETWEEN 0 AND 5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_policy_recheck_id_caps_type_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_policy_recheck_id_caps_type_chk
      CHECK (jsonb_typeof(policy_recheck_identifier_caps) = 'object');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_policy_recheck_id_caps_shape_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_policy_recheck_id_caps_shape_chk
      CHECK (
        jsonb_typeof(policy_recheck_identifier_caps) = 'object' AND
        policy_recheck_identifier_caps ? 'keywords' AND
        policy_recheck_identifier_caps ? 'genres' AND
        policy_recheck_identifier_caps ? 'studios' AND
        policy_recheck_identifier_caps ? 'cast' AND
        (policy_recheck_identifier_caps - 'keywords' - 'genres' - 'studios' - 'cast') = '{}'::jsonb AND
        (policy_recheck_identifier_caps ->> 'keywords') ~ '^\d+$' AND
        (policy_recheck_identifier_caps ->> 'genres') ~ '^\d+$' AND
        (policy_recheck_identifier_caps ->> 'studios') ~ '^\d+$' AND
        (policy_recheck_identifier_caps ->> 'cast') ~ '^\d+$' AND
        (policy_recheck_identifier_caps ->> 'keywords')::INTEGER BETWEEN 0 AND 25 AND
        (policy_recheck_identifier_caps ->> 'genres')::INTEGER BETWEEN 0 AND 25 AND
        (policy_recheck_identifier_caps ->> 'studios')::INTEGER BETWEEN 0 AND 25 AND
        (policy_recheck_identifier_caps ->> 'cast')::INTEGER BETWEEN 0 AND 25
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_policy_recheck_min_sim_delta_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_policy_recheck_min_sim_delta_chk
      CHECK (policy_recheck_min_similarity_delta BETWEEN 0.00 AND 1.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_policy_recheck_min_margin_delta_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_policy_recheck_min_margin_delta_chk
      CHECK (policy_recheck_min_margin_delta BETWEEN 0.00 AND 100.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_policy_recheck_min_conf_gain_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_policy_recheck_min_conf_gain_chk
      CHECK (policy_recheck_min_confidence_gain BETWEEN 0.00 AND 100.00);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_policy_recheck_ai_calls_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_policy_recheck_ai_calls_chk
      CHECK (policy_recheck_max_ai_calls_per_item BETWEEN 1 AND 5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_policy_recheck_missing_fields_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_policy_recheck_missing_fields_chk
      CHECK (policy_recheck_metadata_missing_fields_min BETWEEN 0 AND 10);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_policy_recheck_timeout_ms_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_policy_recheck_timeout_ms_chk
      CHECK (policy_recheck_metadata_timeout_ms BETWEEN 100 AND 30000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_policy_recheck_metadata_attempts_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_policy_recheck_metadata_attempts_chk
      CHECK (policy_recheck_metadata_max_attempts BETWEEN 0 AND 5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_policy_recheck_source_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_policy_recheck_source_chk
      CHECK (policy_recheck_metadata_source = 'authoritative_only');
  END IF;
END $$;

COMMENT ON COLUMN ai_provider_config.rag_retrieval_loop_enabled IS 'Enable bounded second-pass retrieval loop.';
COMMENT ON COLUMN ai_provider_config.rag_loop_rollout_mode IS 'Second-pass rollout mode: shadow or apply.';
COMMENT ON COLUMN ai_provider_config.rag_loop_low_confidence_threshold IS 'AI fallback trigger threshold in percent.';
COMMENT ON COLUMN ai_provider_config.rag_loop_max_passes IS 'Maximum retrieval passes for each item.';
COMMENT ON COLUMN ai_provider_config.rag_loop_use_hybrid_on_retry IS 'Force hybrid retrieval for retry path when enabled.';
COMMENT ON COLUMN ai_provider_config.rag_loop_conflict_detection_enabled IS 'Enable conflict-based second-pass trigger evaluation.';
COMMENT ON COLUMN ai_provider_config.rag_retry_strategy IS 'Retry strategy selector: auto, hybrid, or semantic.';
COMMENT ON COLUMN ai_provider_config.rag_retry_low_signal_similarity_floor IS 'Low-signal floor for strategy selection.';
COMMENT ON COLUMN ai_provider_config.rag_retry_conflict_semantic_preferred IS 'Prefer semantic retry for high-quality conflict cases.';
COMMENT ON COLUMN ai_provider_config.rag_retry_sparse_metadata_prefers_hybrid IS 'Prefer hybrid retry when metadata is sparse.';
COMMENT ON COLUMN ai_provider_config.rag_loop_candidate_limit IS 'Candidate pool size for second-pass diagnostics.';
COMMENT ON COLUMN ai_provider_config.rag_conflict_top_n IS 'Top-N matches used for conflict detection.';
COMMENT ON COLUMN ai_provider_config.rag_conflict_min_matches IS 'Minimum candidate matches required before conflict logic runs.';
COMMENT ON COLUMN ai_provider_config.rag_conflict_min_votes_per_library IS 'Minimum per-library votes required for conflict split.';
COMMENT ON COLUMN ai_provider_config.rag_conflict_max_vote_gap IS 'Maximum vote gap allowed for conflict classification.';
COMMENT ON COLUMN ai_provider_config.rag_conflict_max_similarity_margin_ratio IS 'Maximum top-two similarity margin ratio for conflict.';
COMMENT ON COLUMN ai_provider_config.rag_conflict_min_avg_similarity IS 'Minimum average similarity quality floor for conflict logic.';
COMMENT ON COLUMN ai_provider_config.policy_recheck_below_prompt_threshold_enabled IS 'Enable targeted policy re-check for prompt_select outcomes.';
COMMENT ON COLUMN ai_provider_config.policy_recheck_max_attempts IS 'Maximum targeted policy re-check attempts per item.';
COMMENT ON COLUMN ai_provider_config.policy_recheck_identifier_caps IS 'JSON caps for targeted identifiers (keywords, genres, studios, cast).';
COMMENT ON COLUMN ai_provider_config.policy_recheck_min_similarity_delta IS 'Minimum similarity improvement required for promoted outcomes.';
COMMENT ON COLUMN ai_provider_config.policy_recheck_min_margin_delta IS 'Minimum top-vs-second margin improvement required for promoted outcomes.';
COMMENT ON COLUMN ai_provider_config.policy_recheck_min_confidence_gain IS 'Minimum confidence gain required for promoted outcomes.';
COMMENT ON COLUMN ai_provider_config.policy_recheck_max_ai_calls_per_item IS 'Maximum AI calls allowed for a single item under re-check flow.';
COMMENT ON COLUMN ai_provider_config.policy_recheck_metadata_enrichment_enabled IS 'Enable authoritative metadata enrichment for policy re-check.';
COMMENT ON COLUMN ai_provider_config.policy_recheck_metadata_missing_fields_min IS 'Minimum missing high-impact fields before enrichment is attempted.';
COMMENT ON COLUMN ai_provider_config.policy_recheck_metadata_timeout_ms IS 'Timeout budget for metadata enrichment calls.';
COMMENT ON COLUMN ai_provider_config.policy_recheck_metadata_max_attempts IS 'Maximum metadata enrichment attempts per item.';
COMMENT ON COLUMN ai_provider_config.policy_recheck_metadata_source IS 'Metadata source policy for re-check enrichment.';
