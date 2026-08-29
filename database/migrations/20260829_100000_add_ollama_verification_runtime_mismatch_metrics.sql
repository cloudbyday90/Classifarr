-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Record only a fixed runtime failure counter and last-observed timestamp.
-- The aggregate contains no model digest, prompt, response, media metadata,
-- endpoint, credential, or item identifier.
ALTER TABLE ai_provider_capability_metrics
    ADD COLUMN IF NOT EXISTS model_digest_mismatch_count BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_model_digest_mismatch_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ai_provider_capability_metrics_model_digest_mismatch_nonnegative_ck'
          AND conrelid = 'public.ai_provider_capability_metrics'::regclass
    ) THEN
        ALTER TABLE ai_provider_capability_metrics
            ADD CONSTRAINT ai_provider_capability_metrics_model_digest_mismatch_nonnegative_ck
            CHECK (model_digest_mismatch_count >= 0) NOT VALID;
    END IF;
END $$;

ALTER TABLE ai_provider_capability_metrics
    VALIDATE CONSTRAINT ai_provider_capability_metrics_model_digest_mismatch_nonnegative_ck;

-- A digest mismatch revokes only the exact tested state that admitted the
-- request. This bounded status is shown to an operator and remains fail-closed
-- until the administrator runs the existing fixed capability test again.
ALTER TABLE ai_provider_config
    DROP CONSTRAINT IF EXISTS ai_provider_config_ollama_verification_capability_status_ck;

ALTER TABLE ai_provider_config
    ADD CONSTRAINT ai_provider_config_ollama_verification_capability_status_ck
    CHECK (ollama_verification_capability_status IN (
        'not_checked',
        'verification_ready',
        'classification_only',
        'unavailable',
        'model_changed'
    )) NOT VALID;

ALTER TABLE ai_provider_config
    VALIDATE CONSTRAINT ai_provider_config_ollama_verification_capability_status_ck;

COMMENT ON TABLE ai_provider_capability_metrics IS
    'Aggregate AI provider capability counters and bounded runtime failure timestamps; no prompts, model output, media data, or actions.';
