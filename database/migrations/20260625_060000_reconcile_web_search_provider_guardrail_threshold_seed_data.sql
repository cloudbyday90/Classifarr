-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
-- Licensed under GPL-3.0 - See LICENSE file for details.
-- @seed-reconciliation snapshot-required

-- Keep fresh installs and upgraded installs aligned on default preview
-- guardrail thresholds without overwriting operator tuning.
INSERT INTO settings (key, value)
VALUES (
    'web_search_provider_guardrail_thresholds',
    '{"enabled":true,"lowSampleMultiplier":1,"recentHealthLookbackCount":10,"selectionChangeSeverity":"info","lowSampleSeverity":"warning","healthIssueSeverity":"warning","cooldownSeverity":"critical","noProviderSeverity":"critical"}'
)
ON CONFLICT (key) DO NOTHING;
