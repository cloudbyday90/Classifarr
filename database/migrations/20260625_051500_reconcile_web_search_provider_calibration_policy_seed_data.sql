-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
-- Licensed under GPL-3.0 - See LICENSE file for details.
-- @seed-reconciliation snapshot-required

-- Keep fresh installs and upgraded installs aligned on the default
-- classification calibration policy without overwriting user tuning.
INSERT INTO web_search_provider_calibration_policies (
    purpose,
    is_enabled,
    lookback_days,
    minimum_samples,
    maximum_priority_penalty,
    outcome_weight
)
VALUES (
    'classification',
    true,
    14,
    3,
    25,
    15
)
ON CONFLICT (purpose) DO NOTHING;
