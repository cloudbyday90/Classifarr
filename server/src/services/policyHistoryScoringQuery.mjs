/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

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

function positiveDatabaseInteger(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^[0-9]{1,10}$/u.test(trimmed)) return null;
    value = Number(trimmed);
  }
  return Number.isInteger(value) && value > 0 && value <= 2_147_483_647 ? value : null;
}

/** Media type belongs to the incoming identity, never the destination library. */
export function buildPolicyHistoryScoringQuery(libraryId, item) {
  const normalizedLibraryId = positiveDatabaseInteger(libraryId);
  const tmdbId = positiveDatabaseInteger(item?.tmdb_id);
  const mediaType = typeof item?.media_type === 'string' ? item.media_type.trim().toLowerCase() : null;
  if (!normalizedLibraryId || !tmdbId || !['movie', 'tv'].includes(mediaType)) return null;

  return Object.freeze({
    libraryId: normalizedLibraryId,
    text: HISTORY_SCORING_SQL,
    values: Object.freeze([tmdbId, mediaType]),
  });
}
