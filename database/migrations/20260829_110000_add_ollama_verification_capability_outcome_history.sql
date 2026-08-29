-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- Daily aggregate evidence for the fixed saved-Ollama capability test. This
-- table deliberately stores no provider, host, port, model, digest, prompt,
-- response, error, media, policy, routing, actor, or configuration data.

CREATE TABLE IF NOT EXISTS ollama_verification_capability_test_outcomes (
    observed_on DATE NOT NULL,
    status_id VARCHAR(40) NOT NULL,
    outcome_count BIGINT NOT NULL DEFAULT 1,
    last_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (observed_on, status_id),
    CONSTRAINT ollama_verification_capability_test_outcomes_status_ck
        CHECK (status_id IN (
            'verification_ready',
            'classification_only',
            'unavailable'
        )),
    CONSTRAINT ollama_verification_capability_test_outcomes_count_ck
        CHECK (outcome_count > 0)
);

COMMENT ON TABLE ollama_verification_capability_test_outcomes IS
    'Fixed 30-day daily counts of saved Ollama verification-test outcomes; contains no configuration or test content.';
