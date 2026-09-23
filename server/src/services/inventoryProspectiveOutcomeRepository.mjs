/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Exact event receipts, not title/identity-only joins. No current-placement requirement. */
export const INVENTORY_PROSPECTIVE_OUTCOME_SQL = `
  SELECT ch.id AS classification_id, ch.tmdb_id, ch.media_type, ch.recorded_at,
    CASE WHEN pg_column_size(ch.metadata #> '{classification_details,inventory_ranking_shadow}') <= 32768
      THEN ch.metadata #> '{classification_details,inventory_ranking_shadow}' ELSE NULL END AS capture,
    COALESCE(outcomes.rows, '[]'::jsonb) AS outcomes
  FROM classification_history ch
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(observation) AS rows FROM (
      SELECT f.selected_library_id AS library_id, f.was_correction, f.responded_at AS observed_at
      FROM policy_feedback_sources receipt
      JOIN policy_feedback_evaluation f ON f.id = receipt.feedback_id
      WHERE receipt.classification_id = ch.id AND f.evaluation_correct IS NOT NULL
        AND f.tmdb_id = ch.tmdb_id AND f.media_type = ch.media_type
        AND isfinite(f.responded_at) AND f.responded_at >= ch.recorded_at AND f.responded_at <= NOW()
      UNION ALL
      SELECT cc.corrected_library_id, true,
        cc.created_at AT TIME ZONE current_setting('TimeZone') AS observed_at
      FROM classification_corrections cc
      JOIN libraries destination ON destination.id = cc.corrected_library_id
        AND destination.is_active IS TRUE AND destination.media_type = ch.media_type
      WHERE cc.classification_id = ch.id
        AND cc.original_library_id IS DISTINCT FROM cc.corrected_library_id
        AND cc.corrected_by IS NOT NULL AND btrim(cc.corrected_by) <> ''
        AND isfinite(cc.created_at)
        AND cc.created_at AT TIME ZONE current_setting('TimeZone') >= ch.recorded_at
        AND cc.created_at <= CURRENT_TIMESTAMP::timestamp
      LIMIT 101
    ) observation
  ) outcomes ON true
  WHERE ch.recorded_at >= $1::timestamptz AND ch.recorded_at < $2::timestamptz
    AND ch.metadata #> '{classification_details,inventory_ranking_shadow}' IS NOT NULL
    AND ch.metadata #> '{classification_details,inventory_ranking_shadow}' <> 'null'::jsonb
  ORDER BY ch.recorded_at, ch.id
  LIMIT 5001
`;
