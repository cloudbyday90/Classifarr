/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS,
  POLICY_CANDIDATE_ADJUDICATION_VERSION,
} from './policyCandidateAdjudicationContract.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_ADJUDICATION_PROPOSAL_VERSION,
} from './policyCandidateSemanticAdjudicationProposalFingerprint.mjs';

export const LOAD_CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_METRICS_SQL = `
  WITH observed AS (
    SELECT
      created_at,
      metadata #>> '{classification_details,candidate_adjudication,semantic_proposal,fingerprint}' AS proposal_fingerprint,
      metadata #>> '{classification_details,candidate_adjudication,semantic_proposal,version}' AS proposal_version,
      metadata #>> '{classification_details,candidate_adjudication,status_id}' AS adjudication_status_id,
      COALESCE(
        metadata #>> '{classification_details,candidate_adjudication,semantic_retrieval_status_id}',
        'not_recorded'
      ) AS semantic_retrieval_status_id,
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
      AND metadata #>> '{classification_details,candidate_adjudication,version}' = $3
  ), valid_frozen_proposals AS (
    SELECT
      created_at,
      proposal_fingerprint,
      adjudication_status_id,
      semantic_retrieval_status_id,
      proposed_library_id,
      final_library_id
    FROM observed
    WHERE proposal_version = $4
      AND proposal_fingerprint ~ '^[a-f0-9]{64}$'
      AND adjudication_status_id IN ($5, $6, $7)
  ), cohorts AS (
    SELECT
      proposal_fingerprint,
      MAX(created_at) AS latest_observed_at,
      COUNT(*)::bigint AS "comparisonCount",
      COUNT(*) FILTER (
        WHERE adjudication_status_id = $5
          AND proposed_library_id IS NOT NULL
      )::bigint AS "proposalCount",
      COUNT(*) FILTER (
        WHERE adjudication_status_id = $6
      )::bigint AS "abstainedCount",
      COUNT(*) FILTER (
        WHERE adjudication_status_id = $7
      )::bigint AS "responseRejectedCount",
      COUNT(*) FILTER (
        WHERE adjudication_status_id = $5
          AND proposed_library_id IS NOT NULL
          AND final_library_id IS NOT NULL
      )::bigint AS "resolvedProposalCount",
      COUNT(*) FILTER (
        WHERE adjudication_status_id = $5
          AND proposed_library_id IS NOT NULL
          AND final_library_id = proposed_library_id
      )::bigint AS "alignedProposalCount",
      COUNT(*) FILTER (
        WHERE semantic_retrieval_status_id = 'available'
      )::bigint AS "semanticContextAvailableCount"
    FROM valid_frozen_proposals
    GROUP BY proposal_fingerprint
  ), selected_cohort AS (
    SELECT *, (SELECT COUNT(*)::bigint FROM cohorts) AS "proposalGroupCount"
    FROM cohorts
    ORDER BY latest_observed_at DESC, proposal_fingerprint ASC
    LIMIT 1
  )
  SELECT
    COALESCE("proposalGroupCount", 0)::bigint AS "proposalGroupCount",
    COALESCE("comparisonCount", 0)::bigint AS "comparisonCount",
    COALESCE("proposalCount", 0)::bigint AS "proposalCount",
    COALESCE("abstainedCount", 0)::bigint AS "abstainedCount",
    COALESCE("responseRejectedCount", 0)::bigint AS "responseRejectedCount",
    COALESCE("resolvedProposalCount", 0)::bigint AS "resolvedProposalCount",
    COALESCE("alignedProposalCount", 0)::bigint AS "alignedProposalCount",
    COALESCE("semanticContextAvailableCount", 0)::bigint AS "semanticContextAvailableCount"
  FROM (SELECT 1) AS fallback
  LEFT JOIN selected_cohort ON TRUE
`;

/** Reads only a count-only, latest-frozen-cohort aggregate. */
export async function loadCurrentLibraryCandidateSemanticAdjudicationWorkbenchMetrics(
  db,
  { start, end } = {},
) {
  if (!(start instanceof Date) || Number.isNaN(start.getTime()) ||
      !(end instanceof Date) || Number.isNaN(end.getTime()) || start >= end) {
    throw new TypeError('A valid aggregate observation range is required.');
  }

  const result = await db.query(
    LOAD_CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_METRICS_SQL,
    [
      start.toISOString(),
      end.toISOString(),
      POLICY_CANDIDATE_ADJUDICATION_VERSION,
      POLICY_CANDIDATE_SEMANTIC_ADJUDICATION_PROPOSAL_VERSION,
      POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS.PROPOSED,
      POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS.ABSTAINED,
      POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS.RESPONSE_REJECTED,
    ],
  );
  return result?.rows?.[0] || {};
}
