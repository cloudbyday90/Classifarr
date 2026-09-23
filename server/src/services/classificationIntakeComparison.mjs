/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const INTAKE_COMPARISON_REASONS = new Set([
  'not_applicable_media', 'no_policy_result', 'no_eligible_pool',
  'invalid_candidate_pool', 'candidate_pool_size', 'retrieval_unavailable',
  'retrieval_mismatch', 'description_unavailable', 'comparison_incomplete',
  'identity_mismatch', 'capture_disabled', 'capture_invalid',
  'unexpected_error', 'not_observed',
]);

export const isClassificationIntakeReason = value => INTAKE_COMPARISON_REASONS.has(value);

/** Fixed diagnostic vocabulary; never turn metadata or provider text into a receipt. */
export function buildClassificationIntakeComparison({ result, mediaType, capture } = {}) {
  if (capture) return Object.freeze({ statusId: 'captured', reasonId: null });
  if (mediaType !== 'movie' && mediaType !== 'tv') {
    return Object.freeze({ statusId: 'not_captured', reasonId: 'not_applicable_media' });
  }
  const policyResult = result?.policyResult ?? result?.signalContext?.policyResult;
  const suggested = policyResult?.inventoryRankingShadowReasonId;
  const reasonId = !policyResult ? 'no_policy_result'
    : policyResult.inventoryRankingShadow && !capture ? 'identity_mismatch'
      : isClassificationIntakeReason(suggested) ? suggested : 'not_observed';
  return Object.freeze({ statusId: 'not_captured', reasonId });
}
