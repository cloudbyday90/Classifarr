-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Migration: add rag loop auto fallback config/state
-- Created: 2026-02-11T09:05:00.000Z
-- Purpose:
--   Add automatic apply->shadow fallback controls, incident state, and auto-recover state.

INSERT INTO ai_provider_config (id, primary_provider)
SELECT 1, 'none'
WHERE NOT EXISTS (
  SELECT 1 FROM ai_provider_config WHERE id = 1
);

ALTER TABLE ai_provider_config
  ADD COLUMN IF NOT EXISTS rag_loop_auto_fallback_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS rag_loop_auto_fallback_min_apply_samples INTEGER DEFAULT 25,
  ADD COLUMN IF NOT EXISTS rag_loop_auto_fallback_consecutive_breaches INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS rag_loop_auto_fallback_cooldown_ms INTEGER DEFAULT 900000,
  ADD COLUMN IF NOT EXISTS rag_loop_auto_recover_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rag_loop_auto_fallback_breach_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rag_loop_auto_fallback_last_breach_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS rag_loop_auto_fallback_last_triggered_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS rag_loop_auto_fallback_cooldown_until TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS rag_loop_auto_fallback_last_incident_id VARCHAR(80) NULL,
  ADD COLUMN IF NOT EXISTS rag_loop_auto_fallback_last_incident_payload JSONB NULL,
  ADD COLUMN IF NOT EXISTS rag_loop_auto_fallback_last_version VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS rag_loop_auto_recover_last_attempt_version VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS rag_loop_auto_recover_last_attempt_at TIMESTAMP NULL;

UPDATE ai_provider_config
SET
  rag_loop_auto_fallback_enabled = COALESCE(rag_loop_auto_fallback_enabled, true),
  rag_loop_auto_fallback_min_apply_samples = LEAST(1000000, GREATEST(1, COALESCE(rag_loop_auto_fallback_min_apply_samples, 25))),
  rag_loop_auto_fallback_consecutive_breaches = LEAST(100, GREATEST(1, COALESCE(rag_loop_auto_fallback_consecutive_breaches, 3))),
  rag_loop_auto_fallback_cooldown_ms = LEAST(86400000, GREATEST(0, COALESCE(rag_loop_auto_fallback_cooldown_ms, 900000))),
  rag_loop_auto_recover_enabled = COALESCE(rag_loop_auto_recover_enabled, false),
  rag_loop_auto_fallback_breach_count = LEAST(1000000, GREATEST(0, COALESCE(rag_loop_auto_fallback_breach_count, 0))),
  rag_loop_auto_fallback_last_incident_payload = CASE
    WHEN rag_loop_auto_fallback_last_incident_payload IS NULL THEN NULL
    WHEN jsonb_typeof(rag_loop_auto_fallback_last_incident_payload) = 'object' THEN rag_loop_auto_fallback_last_incident_payload
    ELSE NULL
  END;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_auto_fallback_min_apply_samples_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_auto_fallback_min_apply_samples_chk
      CHECK (rag_loop_auto_fallback_min_apply_samples BETWEEN 1 AND 1000000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_auto_fallback_consecutive_breaches_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_auto_fallback_consecutive_breaches_chk
      CHECK (rag_loop_auto_fallback_consecutive_breaches BETWEEN 1 AND 100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_auto_fallback_cooldown_ms_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_auto_fallback_cooldown_ms_chk
      CHECK (rag_loop_auto_fallback_cooldown_ms BETWEEN 0 AND 86400000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_auto_fallback_breach_count_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_auto_fallback_breach_count_chk
      CHECK (rag_loop_auto_fallback_breach_count BETWEEN 0 AND 1000000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_cfg_auto_fallback_incident_payload_type_chk') THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_auto_fallback_incident_payload_type_chk
      CHECK (
        rag_loop_auto_fallback_last_incident_payload IS NULL
        OR jsonb_typeof(rag_loop_auto_fallback_last_incident_payload) = 'object'
      );
  END IF;
END $$;

COMMENT ON COLUMN ai_provider_config.rag_loop_auto_fallback_enabled IS 'Enable automatic rollout fallback from apply to shadow on sustained regressions.';
COMMENT ON COLUMN ai_provider_config.rag_loop_auto_fallback_min_apply_samples IS 'Minimum apply-mode samples required before fallback gates are evaluated.';
COMMENT ON COLUMN ai_provider_config.rag_loop_auto_fallback_consecutive_breaches IS 'Consecutive breach windows required before triggering automatic fallback.';
COMMENT ON COLUMN ai_provider_config.rag_loop_auto_fallback_cooldown_ms IS 'Cooldown duration after fallback to prevent mode-flapping.';
COMMENT ON COLUMN ai_provider_config.rag_loop_auto_recover_enabled IS 'Enable version-aware automatic re-enable of apply mode after fallback.';
COMMENT ON COLUMN ai_provider_config.rag_loop_auto_fallback_breach_count IS 'Current consecutive fallback breach counter.';
COMMENT ON COLUMN ai_provider_config.rag_loop_auto_fallback_last_breach_at IS 'Timestamp of the most recent observed fallback breach.';
COMMENT ON COLUMN ai_provider_config.rag_loop_auto_fallback_last_triggered_at IS 'Timestamp of the last automatic fallback transition.';
COMMENT ON COLUMN ai_provider_config.rag_loop_auto_fallback_cooldown_until IS 'Timestamp until which fallback evaluation remains in cooldown.';
COMMENT ON COLUMN ai_provider_config.rag_loop_auto_fallback_last_incident_id IS 'Latest automatic fallback incident identifier.';
COMMENT ON COLUMN ai_provider_config.rag_loop_auto_fallback_last_incident_payload IS 'Latest sanitized automatic fallback incident payload.';
COMMENT ON COLUMN ai_provider_config.rag_loop_auto_fallback_last_version IS 'Application version that triggered the latest fallback.';
COMMENT ON COLUMN ai_provider_config.rag_loop_auto_recover_last_attempt_version IS 'Most recent app version used for auto-recover attempt.';
COMMENT ON COLUMN ai_provider_config.rag_loop_auto_recover_last_attempt_at IS 'Timestamp of most recent auto-recover attempt.';
