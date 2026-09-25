/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const evaluationGapDetails = Object.freeze({
  configuration_unavailable: ['Local AI configuration unavailable', 'Check the configured local provider and model. New inputs are evaluated automatically.'],
  runtime_unavailable: ['Replay inputs unavailable', 'Wait for library evidence to become available; changed inputs are evaluated automatically.'],
  not_adjudication: ['Outside paired AI comparison', 'One arm does not require candidate adjudication. Additional AI calls cannot complete this paired test.'],
  scope_unavailable: ['Candidate scope exceeds the test limit', 'The bounded evaluator cannot prepare this candidate set. Review the evaluation scope; routing is unchanged.'],
  evidence_unavailable: ['Library evidence incomplete', 'Allow library discovery and indexing to finish. Changed evidence is evaluated automatically.'],
  evidence_changed: ['Evidence changed during preparation', 'A new consistent input snapshot is needed; changed evidence is evaluated automatically.'],
  request_invalid: ['Request exceeds the supported contract', 'Review prompt size and candidate count. Retrying the same request cannot repair its contract.'],
  output_limited: ['AI output reached its limit', 'Retain this failure for evaluation. A separately versioned model or prompt experiment is needed, not retries until success.'],
  context_limited: ['AI context limit suspected', 'Review the model context and prompt size in a separate experiment. This is a suspected limit, not confirmed truncation.'],
  invalid_response: ['AI response rejected', 'The response did not produce a valid proposal or abstention. Keep it as a failed comparison; do not retry until it passes.'],
  unknown: ['Reason not recorded', 'Older results have no diagnosis. Future evaluations record reasons; no cause is inferred from old data.'],
  cache_missing: ['Cached AI response missing', 'Scheduled capture fills missing responses when enabled, admitted and within quota. This saved snapshot does not report current capture readiness.'],
})

export function normalizeEvaluationGaps(value, missing, legacy = false) {
  const keys = Object.keys(evaluationGapDetails)
  if (legacy) return Object.fromEntries(keys.map(key => [key, key === 'unknown' ? missing : 0]))
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length ||
    !keys.every(key => Object.hasOwn(value, key) && Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= missing) ||
    keys.reduce((sum, key) => sum + value[key], 0) !== missing) return null
  return Object.fromEntries(keys.map(key => [key, value[key]]))
}
