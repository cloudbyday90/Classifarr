/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function isSuggestionReviewConflict(error) {
  return error?.response?.status === 409 &&
    ['SUGGESTION_NOT_PENDING', 'SUGGESTION_POLICY_CHANGED',
      'SUGGESTION_EVIDENCE_REQUIRED', 'SUGGESTION_EVIDENCE_STALE', 'SUGGESTION_EVIDENCE_BUSY'].includes(error.response.data?.code)
}
