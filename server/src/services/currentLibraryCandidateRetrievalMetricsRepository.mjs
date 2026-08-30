/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS,
  POLICY_CANDIDATE_ADJUDICATION_VERSION,
} from './policyCandidateAdjudicationContract.mjs';
import {
  CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_TELEMETRY_VERSION,
} from './currentLibraryCandidateRetrievalTelemetry.mjs';

export const LOAD_CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_SQL = `
  WITH observed AS (
    SELECT
      metadata #>> '{classification_details,current_library_candidate_retrieval_telemetry,status_id}' AS retrieval_status_id,
      metadata #>> '{classification_details,current_library_candidate_retrieval_telemetry,latency_band}' AS latency_band,
      CASE
        WHEN metadata #>> '{classification_details,current_library_candidate_retrieval_telemetry,matched_candidate_count}' ~ '^\\d+$'
          THEN (metadata #>> '{classification_details,current_library_candidate_retrieval_telemetry,matched_candidate_count}')::integer
        ELSE 0
      END AS matched_candidate_count,
      CASE
        WHEN metadata #>> '{classification_details,current_library_candidate_retrieval_telemetry,direct_match_candidate_count}' ~ '^\\d+$'
          THEN (metadata #>> '{classification_details,current_library_candidate_retrieval_telemetry,direct_match_candidate_count}')::integer
        ELSE 0
      END AS direct_match_candidate_count,
      metadata #>> '{classification_details,candidate_adjudication,version}' AS adjudication_version,
      metadata #>> '{classification_details,candidate_adjudication,status_id}' AS adjudication_status_id,
      CASE
        WHEN metadata #>> '{classification_details,candidate_adjudication,proposed_destination,library_id}' ~ '^[1-9]\\d*$'
          THEN (metadata #>> '{classification_details,candidate_adjudication,proposed_destination,library_id}')::bigint
        ELSE NULL
      END AS proposed_library_id,
      CASE
        WHEN metadata #>> '{classification_details,outcome_path,latest_outcome,final_library_id}' ~ '^[1-9]\\d*$'
          THEN (metadata #>> '{classification_details,outcome_path,latest_outcome,final_library_id}')::bigint
        ELSE NULL
      END AS final_library_id
    FROM classification_history
    WHERE created_at >= $1
      AND created_at < $2
      AND metadata #>> '{classification_details,current_library_candidate_retrieval_telemetry,version}' = $3
  )
  SELECT
    COUNT(*)::bigint AS "observationCount",
    COUNT(*) FILTER (WHERE retrieval_status_id = 'available')::bigint AS "availableCount",
    COUNT(*) FILTER (WHERE retrieval_status_id = 'unavailable')::bigint AS "unavailableCount",
    COUNT(*) FILTER (WHERE retrieval_status_id = 'available' AND matched_candidate_count > 0)::bigint AS "matchingObservationCount",
    COUNT(*) FILTER (WHERE retrieval_status_id = 'available' AND direct_match_candidate_count > 0)::bigint AS "directMatchObservationCount",
    COUNT(*) FILTER (WHERE latency_band = 'under_25ms')::bigint AS "under25msCount",
    COUNT(*) FILTER (WHERE latency_band = '25_to_99ms')::bigint AS "from25To99msCount",
    COUNT(*) FILTER (WHERE latency_band = '100_to_249ms')::bigint AS "from100To249msCount",
    COUNT(*) FILTER (WHERE latency_band = '250_to_999ms')::bigint AS "from250To999msCount",
    COUNT(*) FILTER (WHERE latency_band = '1000ms_or_more')::bigint AS "from1000msOrMoreCount",
    COUNT(*) FILTER (
      WHERE adjudication_version = $4
        AND adjudication_status_id = $5
        AND proposed_library_id IS NOT NULL
    )::bigint AS "proposalCount",
    COUNT(*) FILTER (
      WHERE adjudication_version = $4
        AND adjudication_status_id = $5
        AND proposed_library_id IS NOT NULL
        AND final_library_id IS NOT NULL
    )::bigint AS "resolvedProposalCount",
    COUNT(*) FILTER (
      WHERE adjudication_version = $4
        AND adjudication_status_id = $5
        AND proposed_library_id IS NOT NULL
        AND final_library_id = proposed_library_id
    )::bigint AS "agreedProposalCount",
    COUNT(*) FILTER (
      WHERE adjudication_version = $4
        AND adjudication_status_id = $5
        AND proposed_library_id IS NOT NULL
        AND final_library_id IS NOT NULL
        AND final_library_id <> proposed_library_id
    )::bigint AS "alternativeProposalCount"
  FROM observed
`;

/**
 * Reads one aggregate row. It never returns classification IDs, titles,
 * library names, provider/model data, prompts, responses, or actor identity.
 */
export async function loadCurrentLibraryCandidateRetrievalMetrics(
  db,
  { start, end } = {},
) {
  if (!(start instanceof Date) || Number.isNaN(start.getTime()) ||
      !(end instanceof Date) || Number.isNaN(end.getTime()) || start >= end) {
    throw new TypeError('A valid aggregate observation range is required.');
  }

  const result = await db.query(LOAD_CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_METRICS_SQL, [
    start.toISOString(),
    end.toISOString(),
    CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_TELEMETRY_VERSION,
    POLICY_CANDIDATE_ADJUDICATION_VERSION,
    POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS.PROPOSED,
  ]);

  return result?.rows?.[0] || {};
}
