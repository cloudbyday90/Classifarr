/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const savedStatuses = new Set(['pending', 'applied', 'rejected', 'superseded'])

export function acknowledgesSuggestionReview(response, action, suggestion) {
  const { data, status } = response ?? {}
  const result = data?.result
  if (status !== 200 || data?.success !== true || result?.success !== true ||
      result.suggestionId !== String(suggestion.id)) return false

  return action === 'apply'
    ? result.status === undefined && result.policyId === suggestion.policy_id && result.type === suggestion.suggestion_type
    : action === 'reject' && result.status === 'rejected'
}

export function isUnconfirmedSuggestionReview(error) {
  const status = error?.response?.status
  return status === 408 || (status >= 500 && status < 600) ||
    (!error?.response && (Boolean(error?.request) || error?.isAxiosError === true))
}

export function readObservedSuggestionStatus(target, proposal) {
  if (proposal?.id === target.id && proposal.policy_id === target.policyId &&
      proposal.suggestion_type === target.type && savedStatuses.has(proposal.status)) return proposal.status
  return 'unknown'
}
