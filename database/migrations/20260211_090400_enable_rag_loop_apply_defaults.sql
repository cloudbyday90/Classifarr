-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Migration: enable issue-275 apply defaults
-- Created: 2026-02-11T09:04:00.000Z
-- Purpose:
--   Activate Issue 275 second-pass behavior by default with immediate apply mode.
--   This removes shadow-first as an operational requirement for rollout.
-- Notes:
--   - Idempotent: safe to run multiple times.
--   - Existing rows are updated so current installs benefit immediately.

ALTER TABLE ai_provider_config
  ALTER COLUMN rag_retrieval_loop_enabled SET DEFAULT true,
  ALTER COLUMN rag_loop_rollout_mode SET DEFAULT 'apply',
  ALTER COLUMN policy_recheck_below_prompt_threshold_enabled SET DEFAULT true;

UPDATE ai_provider_config
SET
  rag_retrieval_loop_enabled = true,
  rag_loop_rollout_mode = 'apply',
  policy_recheck_below_prompt_threshold_enabled = true
WHERE
  rag_retrieval_loop_enabled IS DISTINCT FROM true
  OR rag_loop_rollout_mode IS DISTINCT FROM 'apply'
  OR policy_recheck_below_prompt_threshold_enabled IS DISTINCT FROM true;

COMMENT ON COLUMN ai_provider_config.rag_retrieval_loop_enabled IS 'Enable bounded second-pass retrieval loop (default enabled).';
COMMENT ON COLUMN ai_provider_config.rag_loop_rollout_mode IS 'Second-pass rollout mode: shadow or apply (default apply).';
COMMENT ON COLUMN ai_provider_config.policy_recheck_below_prompt_threshold_enabled IS 'Enable targeted policy re-check for prompt_select outcomes (default enabled).';
