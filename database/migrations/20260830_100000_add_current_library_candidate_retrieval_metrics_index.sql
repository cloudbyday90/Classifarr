-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- Current-library retrieval telemetry persists only fixed status, latency-band,
-- and count fields inside the existing classification history JSON envelope.
-- This partial index keeps aggregate read-only monitoring responsive without
-- creating a second item-level telemetry table.
CREATE INDEX IF NOT EXISTS idx_classification_history_current_library_retrieval_observe
  ON classification_history (created_at DESC)
  WHERE (metadata #>> '{classification_details,current_library_candidate_retrieval_telemetry,version}') =
    'current_library.candidate_retrieval_telemetry.v1';
