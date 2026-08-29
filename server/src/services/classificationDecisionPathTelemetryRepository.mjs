/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  CLASSIFICATION_DETERMINISTIC_AI_MODE_VERSION,
} from './classificationDeterministicAiMode.mjs';
import {
  CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_VERSION,
} from './classificationCandidateBoundVerificationContract.mjs';

export const LOAD_CLASSIFICATION_DECISION_PATH_TELEMETRY_SQL = `
  SELECT
    COUNT(*) FILTER (
      WHERE metadata #>> '{classification_details,deterministic_ai_mode,version}' = $3
        AND metadata #>> '{classification_details,deterministic_ai_mode,mode}' = 'skip'
        AND metadata #>> '{classification_details,deterministic_ai_mode,invoked}' = 'false'
        AND metadata #>> '{classification_details,deterministic_ai_mode,reason_code}' = 'policy_auto'
    )::bigint AS deterministic_policy_count,
    COUNT(*) FILTER (
      WHERE metadata #>> '{classification_details,deterministic_ai_mode,version}' = $3
        AND metadata #>> '{classification_details,deterministic_ai_mode,invoked}' = 'true'
    )::bigint AS ai_classification_attempt_count,
    COUNT(*) FILTER (
      WHERE status = 'pending_retry'
        AND method = 'queued_for_retry'
    )::bigint AS ai_unavailable_retry_count,
    COUNT(*) FILTER (
      WHERE metadata #>> '{classification_details,candidate_bound_verification,version}' = $4
        AND metadata #>> '{classification_details,candidate_bound_verification,status_id}' = 'abstained'
    )::bigint AS strict_verification_abstention_count
  FROM classification_history
  WHERE created_at >= $1
    AND created_at < $2
`;

/**
 * Reads four fixed aggregate counters from retained classification history.
 * It deliberately selects no row identity or classification content.
 */
export async function loadClassificationDecisionPathTelemetry(
  db,
  { start, end } = {},
) {
  if (!(start instanceof Date) || Number.isNaN(start.getTime()) ||
      !(end instanceof Date) || Number.isNaN(end.getTime()) || start >= end) {
    throw new TypeError('A valid aggregate observation range is required.');
  }

  const result = await db.query(LOAD_CLASSIFICATION_DECISION_PATH_TELEMETRY_SQL, [
    start.toISOString(),
    end.toISOString(),
    CLASSIFICATION_DETERMINISTIC_AI_MODE_VERSION,
    CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_VERSION,
  ]);

  return result?.rows?.[0] || {};
}
