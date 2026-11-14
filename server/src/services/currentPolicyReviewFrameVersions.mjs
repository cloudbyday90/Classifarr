/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const CURRENT_POLICY_REVIEW_VERSION = 'policy.current_review.v1';
export const CURRENT_POLICY_SELECT_REVIEW_VERSION = 'policy.current_review.v2';

/** Preserve the original recorded-action contract; select has its own prospective version. */
export function currentPolicyReviewVersionForAction(action) {
  if (action === 'prompt_confirm') return CURRENT_POLICY_REVIEW_VERSION;
  if (action === 'prompt_select') return CURRENT_POLICY_SELECT_REVIEW_VERSION;
  return null;
}

export function currentPolicyReviewVersionSupportsMethod(version, method) {
  return version === CURRENT_POLICY_REVIEW_VERSION ||
    version === CURRENT_POLICY_SELECT_REVIEW_VERSION && method === 'policy_recheck';
}
