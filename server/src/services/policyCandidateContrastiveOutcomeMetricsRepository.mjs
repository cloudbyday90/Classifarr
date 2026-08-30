/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS,
  POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_VERSION,
} from './policyCandidateContrastiveEvidence.mjs';
import {
  POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_ATTRIBUTION_VERSION,
} from './policyCandidateContrastiveOutcomeAttribution.mjs';
import {
  POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS,
} from './policyRuntimeCandidateSetSelectionOutcome.mjs';

export const POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRIC_STATUS_IDS = Object.freeze([
  POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.LEADING_IDENTITY_MATCH,
  POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.ALTERNATIVE_IDENTITY_MATCH,
  POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.SHARED_IDENTITY_MATCH,
  POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.NO_CANDIDATE_IDENTITY_MATCH,
  POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.IDENTITY_UNVERIFIED,
  POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_STATUS_IDS.RETRIEVAL_UNAVAILABLE,
]);

export const LOAD_POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRICS_SQL = `
  WITH observed AS (
    SELECT
      metadata #>> '{classification_details,candidate_contrastive_evidence,status_id}' AS contrastive_status_id,
      metadata #>> '{classification_details,policy_candidate_contrastive_outcome_attribution,version}' AS attribution_version,
      metadata #>> '{classification_details,policy_candidate_contrastive_outcome_attribution,selection_status_id}' AS selection_status_id,
      CASE
        WHEN metadata #>> '{classification_details,outcome_path,latest_outcome,final_library_id}' ~ '^[1-9]\\d*$'
          THEN (metadata #>> '{classification_details,outcome_path,latest_outcome,final_library_id}')::bigint
        ELSE NULL
      END AS final_library_id
    FROM classification_history
    WHERE created_at >= $1
      AND created_at < $2
      AND metadata #>> '{classification_details,candidate_contrastive_evidence,version}' = $3
      AND metadata #>> '{classification_details,candidate_contrastive_evidence,status_id}' = ANY($4::text[])
  )
  SELECT
    contrastive_status_id AS "contrastiveStatusId",
    COUNT(*)::bigint AS "observationCount",
    COUNT(*) FILTER (WHERE final_library_id IS NOT NULL)::bigint AS "resolvedOutcomeCount",
    COUNT(*) FILTER (
      WHERE attribution_version = $5
    )::bigint AS "attributedOutcomeCount",
    COUNT(*) FILTER (
      WHERE attribution_version = $5
        AND selection_status_id = $6
    )::bigint AS "confirmedCandidateOutcomeCount",
    COUNT(*) FILTER (
      WHERE attribution_version = $5
        AND selection_status_id = $7
    )::bigint AS "changedToCandidateOutcomeCount",
    COUNT(*) FILTER (
      WHERE attribution_version = $5
        AND selection_status_id = $8
    )::bigint AS "changedOutsideCandidateOutcomeCount",
    COUNT(*) FILTER (
      WHERE attribution_version = $5
        AND selection_status_id = $9
    )::bigint AS "routedNotApplicableOutcomeCount"
  FROM observed
  GROUP BY contrastive_status_id
  ORDER BY array_position($4::text[], contrastive_status_id)
`;

/**
 * Reads fixed, low-cardinality aggregate rows. It intentionally excludes
 * classification, library, candidate, destination, media, provider, model,
 * prompt, response, actor, and free-form rationale fields.
 */
export async function loadPolicyCandidateContrastiveOutcomeMetrics(
  db,
  { start, end } = {},
) {
  if (!(start instanceof Date) || Number.isNaN(start.getTime()) ||
      !(end instanceof Date) || Number.isNaN(end.getTime()) || start >= end) {
    throw new TypeError('A valid aggregate observation range is required.');
  }

  const result = await db.query(LOAD_POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRICS_SQL, [
    start.toISOString(),
    end.toISOString(),
    POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_VERSION,
    POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_METRIC_STATUS_IDS,
    POLICY_CANDIDATE_CONTRASTIVE_OUTCOME_ATTRIBUTION_VERSION,
    POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.CONFIRMED_CANDIDATE,
    POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.CHANGED_TO_CANDIDATE,
    POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.CHANGED_OUTSIDE_CANDIDATES,
    POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.ROUTED_NOT_APPLICABLE,
  ]);

  return Array.isArray(result?.rows) ? result.rows : [];
}
