-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- The history endpoint retains one canonical outcome per stable media identity.
-- Its DISTINCT ON ordering must match this expression index exactly so the
-- database can read the chosen outcome without sorting full JSONB history rows.
-- The migration runner applies files inside a transaction, so this intentionally
-- uses a standard CREATE INDEX rather than CREATE INDEX CONCURRENTLY.
CREATE INDEX IF NOT EXISTS idx_classification_history_canonical_outcome
  ON classification_history (
    (
      CASE
        WHEN tmdb_id IS NOT NULL
          THEN 'tmdb:' || media_type || ':' || tmdb_id::text
        ELSE
          'title:' || media_type || ':' || LOWER(TRIM(title)) || ':' || COALESCE(year::text, '')
      END
    ),
    (
      CASE
        WHEN method != 'source_library'
          AND status IN ('completed', 'corrected', 'verified', 'routed') THEN 0
        WHEN method != 'source_library'
          AND status IN ('awaiting_decision', 'pending', 'pending_retry') THEN 1
        WHEN method != 'source_library' THEN 2
        ELSE 3
      END
    ),
    created_at DESC,
    id DESC
  );
