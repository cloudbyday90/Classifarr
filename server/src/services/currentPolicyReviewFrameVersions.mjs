/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const CURRENT_POLICY_REVIEW_VERSION = 'policy.current_review.v1';
export const CURRENT_POLICY_SELECT_REVIEW_VERSION = 'policy.current_review.v2';
export const CURRENT_POLICY_AUTO_REVIEW_VERSION = 'policy.current_review.v3';

/** Keep each prospective recorded-action contract distinct from the original confirm version. */
export function currentPolicyReviewVersionForAction(action) {
  if (action === 'prompt_confirm') return CURRENT_POLICY_REVIEW_VERSION;
  if (action === 'prompt_select') return CURRENT_POLICY_SELECT_REVIEW_VERSION;
  if (action === 'auto_classify') return CURRENT_POLICY_AUTO_REVIEW_VERSION;
  return null;
}

/** Method of the adopted policy candidate, before any separately fulfilled verification. */
export function currentPolicyReviewCandidateMethod(version) {
  if (version === CURRENT_POLICY_AUTO_REVIEW_VERSION) return 'policy_auto';
  if (version === CURRENT_POLICY_REVIEW_VERSION || version === CURRENT_POLICY_SELECT_REVIEW_VERSION) return 'policy_recheck';
  return null;
}

export function currentPolicyReviewVersionSupportsMethod(version, method) {
  return version === CURRENT_POLICY_REVIEW_VERSION ||
    version === CURRENT_POLICY_SELECT_REVIEW_VERSION && method === 'policy_recheck' ||
    version === CURRENT_POLICY_AUTO_REVIEW_VERSION && method === 'policy_auto';
}
