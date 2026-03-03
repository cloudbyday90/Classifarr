-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- Adds Issue 275 config gate:
-- Multiplier applied to the minimum confidence gain required when promoting
-- a second-pass recheck outcome, allowing finer control over recheck aggressiveness.

ALTER TABLE ai_provider_config
  ADD COLUMN IF NOT EXISTS policy_recheck_confidence_gain_multiplier NUMERIC(5,2) DEFAULT 2;

UPDATE ai_provider_config
SET policy_recheck_confidence_gain_multiplier = 2
WHERE policy_recheck_confidence_gain_multiplier IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_cfg_policy_recheck_conf_gain_mult_chk'
  ) THEN
    ALTER TABLE ai_provider_config
      ADD CONSTRAINT ai_cfg_policy_recheck_conf_gain_mult_chk
      CHECK (policy_recheck_confidence_gain_multiplier >= 1.0 AND policy_recheck_confidence_gain_multiplier <= 10.0);
  END IF;
END;
$$;

COMMENT ON COLUMN ai_provider_config.policy_recheck_confidence_gain_multiplier IS 'Multiplier applied to minimum confidence gain threshold during second-pass recheck (1.0-10.0).';
