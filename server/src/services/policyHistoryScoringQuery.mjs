/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { canonicalMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';

const HISTORY_SCORING_SQL = `
  SELECT
    library_id,
    MAX(confidence) AS confidence,
    COUNT(*) AS match_count
  FROM classification_history
  WHERE tmdb_id = $1::integer
    AND media_type = $2::text
    AND status = 'completed'
    AND library_id IS NOT NULL
  GROUP BY library_id
  ORDER BY match_count DESC, confidence DESC, library_id ASC
  LIMIT 5
`;

/** Media type belongs to the incoming identity, never the destination library. */
export function buildPolicyHistoryScoringQuery(libraryId, item) {
  const normalizedLibraryId = positiveDatabaseInteger(libraryId);
  const tmdbId = positiveDatabaseInteger(item?.tmdb_id);
  const mediaType = canonicalMediaType(item?.media_type);
  if (!normalizedLibraryId || !tmdbId || !mediaType) return null;

  return Object.freeze({
    libraryId: normalizedLibraryId,
    text: HISTORY_SCORING_SQL,
    values: Object.freeze([tmdbId, mediaType]),
  });
}
