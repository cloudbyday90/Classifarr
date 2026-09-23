/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Count only retained movie/TV history in the exact capture window, with a sentinel ceiling. */
export const INVENTORY_PROSPECTIVE_ACTIVITY_SQL = `
  SELECT COUNT(*)::int AS recorded_movie_tv_events
  FROM (
    SELECT 1 FROM classification_history
    WHERE recorded_at >= $1::timestamptz AND recorded_at < $2::timestamptz
      AND media_type IN ('movie', 'tv')
    LIMIT 5001
  ) bounded_events
`;
