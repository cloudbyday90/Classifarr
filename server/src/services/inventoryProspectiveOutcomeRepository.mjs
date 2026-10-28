/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { AUTHORIZED_OUTCOME_EVALUATION_SQL } from './authorizedOutcomeEvaluationQuery.mjs';
import { INVENTORY_PROSPECTIVE_LEGACY_OUTCOMES_SQL } from './inventoryProspectiveLegacyOutcomeSql.mjs';

/** Exact event receipts, not title/identity-only joins. No current-placement requirement. */
export const INVENTORY_PROSPECTIVE_OUTCOME_SQL = `
  WITH authorized AS MATERIALIZED (${AUTHORIZED_OUTCOME_EVALUATION_SQL}), captures AS MATERIALIZED (
  SELECT ch.id AS classification_id, ch.tmdb_id, ch.media_type, ch.recorded_at,
    CASE WHEN pg_column_size(ch.metadata #> '{classification_details,inventory_ranking_shadow}') <= 32768
      THEN ch.metadata #> '{classification_details,inventory_ranking_shadow}' ELSE NULL END AS capture,
    CASE WHEN pg_column_size(ch.metadata #> '{classification_details,destination_decision}') <= 1024
      THEN ch.metadata #> '{classification_details,destination_decision}' END AS original_decision
  FROM classification_history ch
  WHERE ch.recorded_at >= $1::timestamptz AND ch.recorded_at < $2::timestamptz
    AND ch.metadata #> '{classification_details,inventory_ranking_shadow}' IS NOT NULL
    AND ch.metadata #> '{classification_details,inventory_ranking_shadow}' <> 'null'::jsonb
  ORDER BY ch.recorded_at, ch.id LIMIT 5001
  )
  SELECT ch.*, COALESCE(outcomes.rows, '[]'::jsonb) AS outcomes
  FROM captures ch
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(observation) AS rows FROM (
      SELECT to_jsonb(a) || jsonb_build_object('classification_id', a.classification_id::text,
        'source_id', a.source_id::text) AS observation FROM authorized a WHERE a.classification_id = ch.classification_id
      UNION ALL
      ${INVENTORY_PROSPECTIVE_LEGACY_OUTCOMES_SQL}
      ORDER BY observation
      LIMIT 101
    ) observation
  ) outcomes ON true
  ORDER BY ch.recorded_at, ch.classification_id
`;
