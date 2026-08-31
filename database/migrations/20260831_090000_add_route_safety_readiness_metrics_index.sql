-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- The AI Settings readiness card reads a fixed, completed UTC-day aggregate
-- over the existing versioned route-safety projection. This partial index
-- bounds that read without creating a second event or telemetry table.

CREATE INDEX IF NOT EXISTS idx_classification_history_route_safety_readiness
  ON classification_history (created_at DESC)
  WHERE (metadata #>> '{classification_details,route_safety,version}') =
    'classification.route_safety.v1';
