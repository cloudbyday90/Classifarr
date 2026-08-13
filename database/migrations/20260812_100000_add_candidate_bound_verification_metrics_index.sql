-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Candidate-bound verification history already stores only a version and
-- allow-listed status identifier. This partial index keeps bounded aggregate
-- monitoring responsive without creating a second item-level telemetry store.
CREATE INDEX IF NOT EXISTS idx_classification_history_candidate_bound_verification_observe
  ON classification_history (created_at DESC)
  WHERE (metadata #>> '{classification_details,candidate_bound_verification,version}') =
    'classification.candidate_bound_verification.v1';
