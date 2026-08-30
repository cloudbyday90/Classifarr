-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- Policy candidate-correction analytics persists only fixed score-margin,
-- evidence-state, and operator-selection status fields in the existing history
-- metadata envelope. This partial index supports bounded, read-only aggregate
-- monitoring without introducing an item-level analytics table.
CREATE INDEX IF NOT EXISTS idx_classification_history_policy_candidate_correction_analytics
  ON classification_history (created_at DESC)
  WHERE (metadata #>> '{classification_details,policy_candidate_correction_outcome_attribution,version}') =
    'policy.candidate_correction_outcome_attribution.v1';
