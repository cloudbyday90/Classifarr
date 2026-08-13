/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  CANDIDATE_BOUND_VERIFICATION_METRIC_STATUS_IDS,
  CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_VERSION,
  normalizeCandidateBoundVerificationMetricRows,
} from './classificationCandidateBoundVerificationMetrics.mjs';

const LOAD_DAILY_OUTCOME_METRICS_SQL = `
  SELECT
    (created_at AT TIME ZONE 'UTC')::date::text AS observed_on,
    metadata #>> '{classification_details,candidate_bound_verification,status_id}' AS status_id,
    COUNT(*)::bigint AS outcome_count
  FROM classification_history
  WHERE created_at >= $1
    AND created_at < $2
    AND metadata #>> '{classification_details,candidate_bound_verification,version}' = $3
    AND metadata #>> '{classification_details,candidate_bound_verification,status_id}' = ANY($4::text[])
  GROUP BY 1, 2
  ORDER BY 1 ASC, 2 ASC
`;

/**
 * Reads only status-only verification projections that already exist in
 * history. It deliberately does not select item, policy, library, provider,
 * model, prompt, response, or candidate columns.
 */
export async function loadCandidateBoundVerificationDailyOutcomeMetrics(
  db,
  { previousStart, currentEnd } = {},
) {
  if (!(previousStart instanceof Date) || Number.isNaN(previousStart.getTime()) ||
      !(currentEnd instanceof Date) || Number.isNaN(currentEnd.getTime()) ||
      previousStart >= currentEnd) {
    throw new TypeError('A valid aggregate observation range is required.');
  }

  const result = await db.query(LOAD_DAILY_OUTCOME_METRICS_SQL, [
    previousStart.toISOString(),
    currentEnd.toISOString(),
    CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_VERSION,
    CANDIDATE_BOUND_VERIFICATION_METRIC_STATUS_IDS,
  ]);

  return normalizeCandidateBoundVerificationMetricRows(result?.rows);
}

export {
  LOAD_DAILY_OUTCOME_METRICS_SQL,
};
