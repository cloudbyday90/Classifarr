/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function isSuggestionReviewConflict(error) {
  return error?.response?.status === 409 &&
    ['SUGGESTION_NOT_PENDING', 'SUGGESTION_POLICY_CHANGED'].includes(error.response.data?.code)
}
