/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const SOURCE_CONFLICT_LIBRARY_WINDOW_LIMITS = Object.freeze({
  libraryLimit: 12,
  librarySelection: 'daily_rotating_library_id_window',
});

const POSITIONAL_INTEGER_PARAMETER = /^\$[1-9]\d*::integer$/u;

/**
 * Builds the trusted SQL CTEs that give bounded, fair library selection to
 * source-conflict readers. The time-derived pivot is stable within a statement
 * and rotates by day, preventing permanent low-ID selection without persisting
 * an operator-managed cursor.
 */
export function sourceConflictLibraryWindowCtes(libraryLimitParameter) {
  if (!POSITIONAL_INTEGER_PARAMETER.test(libraryLimitParameter)) {
    throw new TypeError('source conflict library window requires a positional integer parameter');
  }
  return `active_libraries AS MATERIALIZED (
  SELECT id, name, media_server_id, external_id, library_rank, active_library_count FROM (
    SELECT id, name, media_server_id, external_id, row_number() OVER (ORDER BY id) AS library_rank,
      COUNT(*) OVER () AS active_library_count
    FROM libraries WHERE is_active=true
  ) AS ranked_active_libraries
), selected_libraries AS MATERIALIZED (
  SELECT * FROM active_libraries
  ORDER BY CASE WHEN library_rank > (
    MOD(FLOOR(EXTRACT(EPOCH FROM date_trunc('day', statement_timestamp())) / 86400)::bigint,
      active_library_count)+1
  ) THEN 0 ELSE 1 END, library_rank
  LIMIT ${libraryLimitParameter}
)`;
}
