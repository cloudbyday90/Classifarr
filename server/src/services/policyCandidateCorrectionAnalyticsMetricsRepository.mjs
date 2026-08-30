/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS,
  POLICY_CANDIDATE_CORRECTION_EVIDENCE_STATE_IDS,
  POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER,
} from './policyCandidateCorrectionSignalSnapshot.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_OUTCOME_ATTRIBUTION_VERSION,
} from './policyCandidateCorrectionOutcomeAttribution.mjs';
import {
  POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS,
} from './policyRuntimeCandidateSetSelectionOutcome.mjs';

export const LOAD_POLICY_CANDIDATE_CORRECTION_ANALYTICS_METRICS_SQL = `
  WITH attributed AS (
    SELECT
      metadata #>> '{classification_details,policy_candidate_correction_outcome_attribution,score_margin_band_id}' AS score_margin_band_id,
      metadata #>> '{classification_details,policy_candidate_correction_outcome_attribution,selection_status_id}' AS selection_status_id,
      metadata #> '{classification_details,policy_candidate_correction_outcome_attribution,evidence_source_states}' AS evidence_source_states
    FROM classification_history
    WHERE created_at >= $1
      AND created_at < $2
      AND metadata #>> '{classification_details,policy_candidate_correction_outcome_attribution,version}' = $3
      AND metadata #>> '{classification_details,policy_candidate_correction_outcome_attribution,score_margin_band_id}' = ANY($4::text[])
      AND metadata #>> '{classification_details,policy_candidate_correction_outcome_attribution,selection_status_id}' = ANY($5::text[])
  ),
  margin_buckets AS (
    SELECT
      score_margin_band_id,
      COUNT(*)::bigint AS outcome_count,
      COUNT(*) FILTER (WHERE selection_status_id = $6)::bigint AS confirmed_leader_outcome_count,
      COUNT(*) FILTER (WHERE selection_status_id = $7)::bigint AS changed_to_candidate_outcome_count,
      COUNT(*) FILTER (WHERE selection_status_id = $8)::bigint AS changed_outside_candidates_outcome_count,
      COUNT(*) FILTER (WHERE selection_status_id = $9)::bigint AS routed_not_applicable_outcome_count
    FROM attributed
    GROUP BY score_margin_band_id
  ),
  source_state_buckets AS (
    SELECT
      source_state ->> 'source_id' AS evidence_source_id,
      source_state ->> 'state_id' AS evidence_state_id,
      COUNT(*)::bigint AS outcome_count,
      COUNT(*) FILTER (WHERE selection_status_id = $6)::bigint AS confirmed_leader_outcome_count,
      COUNT(*) FILTER (WHERE selection_status_id = $7)::bigint AS changed_to_candidate_outcome_count,
      COUNT(*) FILTER (WHERE selection_status_id = $8)::bigint AS changed_outside_candidates_outcome_count,
      COUNT(*) FILTER (WHERE selection_status_id = $9)::bigint AS routed_not_applicable_outcome_count
    FROM attributed
    CROSS JOIN LATERAL jsonb_array_elements(evidence_source_states) AS source_state
    WHERE source_state ->> 'source_id' = ANY($10::text[])
      AND source_state ->> 'state_id' = ANY($11::text[])
    GROUP BY evidence_source_id, evidence_state_id
  )
  SELECT
    'margin_band'::text AS "rowKind",
    score_margin_band_id AS "scoreMarginBandId",
    NULL::text AS "evidenceSourceId",
    NULL::text AS "evidenceStateId",
    outcome_count AS "outcomeCount",
    confirmed_leader_outcome_count AS "confirmedLeaderOutcomeCount",
    changed_to_candidate_outcome_count AS "changedToCandidateOutcomeCount",
    changed_outside_candidates_outcome_count AS "changedOutsideCandidatesOutcomeCount",
    routed_not_applicable_outcome_count AS "routedNotApplicableOutcomeCount"
  FROM margin_buckets
  UNION ALL
  SELECT
    'evidence_source_state'::text AS "rowKind",
    NULL::text AS "scoreMarginBandId",
    evidence_source_id AS "evidenceSourceId",
    evidence_state_id AS "evidenceStateId",
    outcome_count AS "outcomeCount",
    confirmed_leader_outcome_count AS "confirmedLeaderOutcomeCount",
    changed_to_candidate_outcome_count AS "changedToCandidateOutcomeCount",
    changed_outside_candidates_outcome_count AS "changedOutsideCandidatesOutcomeCount",
    routed_not_applicable_outcome_count AS "routedNotApplicableOutcomeCount"
  FROM source_state_buckets
`;

/**
 * Reads fixed, aggregate-only correction analytics. The query has no media,
 * candidate, destination, library, actor, provider, prompt, or response
 * dimension.
 */
export async function loadPolicyCandidateCorrectionAnalyticsMetrics(
  db,
  { start, end } = {},
) {
  if (!(start instanceof Date) || Number.isNaN(start.getTime()) ||
      !(end instanceof Date) || Number.isNaN(end.getTime()) || start >= end) {
    throw new TypeError('A valid aggregate observation range is required.');
  }

  const result = await db.query(LOAD_POLICY_CANDIDATE_CORRECTION_ANALYTICS_METRICS_SQL, [
    start.toISOString(),
    end.toISOString(),
    POLICY_CANDIDATE_CORRECTION_OUTCOME_ATTRIBUTION_VERSION,
    POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER,
    Object.values(POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS),
    POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.CONFIRMED_CANDIDATE,
    POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.CHANGED_TO_CANDIDATE,
    POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.CHANGED_OUTSIDE_CANDIDATES,
    POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS.ROUTED_NOT_APPLICABLE,
    POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS,
    POLICY_CANDIDATE_CORRECTION_EVIDENCE_STATE_IDS,
  ]);

  return Array.isArray(result?.rows) ? result.rows : [];
}
