-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- Adds Issue 275 config gate:
-- Skip second-pass policy recheck when AI confidence is already above the
-- policy auto-classify threshold and no prompt-risk signals are present.

ALTER TABLE ai_provider_config
  ADD COLUMN IF NOT EXISTS policy_recheck_skip_when_ai_confident_enabled BOOLEAN DEFAULT true;

UPDATE ai_provider_config
SET policy_recheck_skip_when_ai_confident_enabled = true
WHERE policy_recheck_skip_when_ai_confident_enabled IS NULL;

