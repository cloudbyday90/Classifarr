/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Ordered blocking causes take precedence over a cache miss in the other arm.
export const EVALUATION_GAP_REASONS = Object.freeze([
  'configuration_unavailable', 'runtime_unavailable', 'not_adjudication', 'scope_unavailable',
  'evidence_unavailable', 'evidence_changed', 'request_invalid', 'output_limited',
  'context_limited', 'invalid_response', 'unknown', 'cache_missing',
]);

/** Map only fixed statuses, never provider strings or error messages. */
export function evaluationArmGap(result) {
  if (['proposed', 'abstained'].includes(result?.status)) return 'none';
  if (result?.status === 'misses') return 'cache_missing';
  if (result?.status === 'unavailable') return EVALUATION_GAP_REASONS.includes(result.gap) ? result.gap : 'unknown';
  if (result?.status === 'output_limited') return 'output_limited';
  if (result?.status === 'context_limit_suspected') return 'context_limited';
  return 'invalid_response';
}

export function validEvaluationGaps(gaps, paired) {
  return Array.isArray(gaps) && gaps.length === 2 && gaps.every(reason =>
    reason === 'none' || EVALUATION_GAP_REASONS.includes(reason)) && paired === gaps.every(reason => reason === 'none');
}

/** One cause per never-completed item; older complete evidence still counts as coverage. */
export function summarizeEvaluationGaps(selected, paired) {
  const gaps = Object.fromEntries(EVALUATION_GAP_REASONS.map(reason => [reason, 0]));
  for (const [item, row] of selected) {
    if (paired.has(item)) continue;
    const reason = EVALUATION_GAP_REASONS.find(value => row.gaps?.includes(value)) ?? 'unknown';
    gaps[reason]++;
  }
  return gaps;
}
