-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
-- Licensed under GPL-3.0 - See LICENSE file for details.

-- Store bounded per-purpose controls for web search provider quality calibration.
-- Secrets, raw queries, and result payloads do not belong in this table.
CREATE TABLE IF NOT EXISTS web_search_provider_calibration_policies (
    purpose character varying(60) PRIMARY KEY,
    is_enabled boolean DEFAULT true NOT NULL,
    lookback_days integer DEFAULT 14 NOT NULL,
    minimum_samples integer DEFAULT 3 NOT NULL,
    maximum_priority_penalty integer DEFAULT 25 NOT NULL,
    outcome_weight integer DEFAULT 15 NOT NULL,
    updated_at timestamp with time zone DEFAULT NOW() NOT NULL,
    CONSTRAINT web_search_provider_calibration_policies_purpose_check
        CHECK (purpose ~ '^[a-z0-9_-]{1,60}$'),
    CONSTRAINT web_search_provider_calibration_policies_lookback_days_check
        CHECK (lookback_days BETWEEN 1 AND 90),
    CONSTRAINT web_search_provider_calibration_policies_minimum_samples_check
        CHECK (minimum_samples BETWEEN 1 AND 100),
    CONSTRAINT web_search_provider_calibration_policies_maximum_priority_penalty_check
        CHECK (maximum_priority_penalty BETWEEN 0 AND 100),
    CONSTRAINT web_search_provider_calibration_policies_outcome_weight_check
        CHECK (outcome_weight BETWEEN 0 AND 50)
);

COMMENT ON TABLE web_search_provider_calibration_policies IS
    'Bounded per-purpose controls for web search provider quality calibration.';
COMMENT ON COLUMN web_search_provider_calibration_policies.purpose IS
    'Stable web search purpose label, such as classification or metadata_enrichment.';
COMMENT ON COLUMN web_search_provider_calibration_policies.is_enabled IS
    'When false, provider quality calibration is neutral for this purpose.';
COMMENT ON COLUMN web_search_provider_calibration_policies.lookback_days IS
    'Usage and outcome lookback window in days.';
COMMENT ON COLUMN web_search_provider_calibration_policies.minimum_samples IS
    'Minimum samples before quality penalties can apply.';
COMMENT ON COLUMN web_search_provider_calibration_policies.maximum_priority_penalty IS
    'Maximum priority points added to a lower-quality provider.';
COMMENT ON COLUMN web_search_provider_calibration_policies.outcome_weight IS
    'Maximum score points deducted from downstream outcome feedback.';
