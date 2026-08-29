-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Persist only a fixed local structured-output verdict, a configuration hash,
-- model digest, and bounded timing/error identifiers. The table already owns
-- endpoint, model, and credential settings; this state never duplicates them.

ALTER TABLE ai_provider_config
    ADD COLUMN IF NOT EXISTS ollama_verification_capability_status VARCHAR(40)
        NOT NULL DEFAULT 'not_checked',
    ADD COLUMN IF NOT EXISTS ollama_verification_capability_fingerprint CHAR(64),
    ADD COLUMN IF NOT EXISTS ollama_verification_capability_configuration_revision BIGINT,
    ADD COLUMN IF NOT EXISTS ollama_verification_capability_model_digest CHAR(64),
    ADD COLUMN IF NOT EXISTS ollama_verification_capability_checked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ollama_verification_capability_error_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS ollama_verification_capability_latency_ms INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ai_provider_config_ollama_verification_capability_status_ck'
          AND conrelid = 'public.ai_provider_config'::regclass
    ) THEN
        ALTER TABLE ai_provider_config
            ADD CONSTRAINT ai_provider_config_ollama_verification_capability_status_ck
            CHECK (ollama_verification_capability_status IN (
                'not_checked',
                'verification_ready',
                'classification_only',
                'unavailable'
            )) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ai_provider_config_ollama_verification_capability_latency_ck'
          AND conrelid = 'public.ai_provider_config'::regclass
    ) THEN
        ALTER TABLE ai_provider_config
            ADD CONSTRAINT ai_provider_config_ollama_verification_capability_latency_ck
            CHECK (
                ollama_verification_capability_latency_ms IS NULL
                OR ollama_verification_capability_latency_ms >= 0
            ) NOT VALID;
    END IF;
END $$;

ALTER TABLE ai_provider_config
    VALIDATE CONSTRAINT ai_provider_config_ollama_verification_capability_status_ck;

ALTER TABLE ai_provider_config
    VALIDATE CONSTRAINT ai_provider_config_ollama_verification_capability_latency_ck;
