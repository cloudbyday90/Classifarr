-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

-- Fix mismatched tmdb_id in webhook_log where they were incorrectly parsed from the first extra field
UPDATE webhook_log
SET tmdb_id = COALESCE(
      (payload->'media'->>'tmdbId')::int,
      (payload->>'tmdb_id')::int
    )
WHERE payload IS NOT NULL
  AND (payload->'media'->>'tmdbId' IS NOT NULL OR payload->>'tmdb_id' IS NOT NULL)
  AND (payload->'media'->>'tmdbId' ~ '^[0-9]+$' OR payload->>'tmdb_id' ~ '^[0-9]+$')
  AND COALESCE(
        (payload->'media'->>'tmdbId')::int,
        (payload->>'tmdb_id')::int
      ) != tmdb_id;

-- Fix mismatched tmdb_id and metadata in classification_history
UPDATE classification_history ch
SET tmdb_id = COALESCE(
      (wl.payload->'media'->>'tmdbId')::int,
      (wl.payload->>'tmdb_id')::int
    ),
    metadata = jsonb_set(
      ch.metadata, 
      '{tmdb_id}', 
      COALESCE(
        wl.payload->'media'->'tmdbId',
        wl.payload->'tmdb_id'
      )
    )
FROM webhook_log wl
WHERE wl.classification_id = ch.id
  AND wl.payload IS NOT NULL
  AND (wl.payload->'media'->>'tmdbId' IS NOT NULL OR wl.payload->>'tmdb_id' IS NOT NULL)
  AND (wl.payload->'media'->>'tmdbId' ~ '^[0-9]+$' OR wl.payload->>'tmdb_id' ~ '^[0-9]+$')
  AND COALESCE(
        (wl.payload->'media'->>'tmdbId')::int,
        (wl.payload->>'tmdb_id')::int
      ) != ch.tmdb_id;

-- Expose historical completed classifications that were never routed and fell below auto-classify threshold in Needs Attention
UPDATE classification_history ch
SET status = 'awaiting_decision',
    pending_reason = 'Awaiting confirmation (historical below threshold)'
WHERE ch.status = 'completed'
  AND ch.confidence < COALESCE(
        (SELECT MAX(auto_classify_threshold) FROM library_policies lp WHERE lp.library_id = ch.library_id AND lp.enabled = true),
        (SELECT value::int FROM settings WHERE key = 'policy_auto_classify_threshold'),
        85
      );
