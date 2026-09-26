/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Callers validate membership and reviewer separation; missing judgments are never votes. */
export function resolveIndependentReviewDecision(first, second, adjudication = null) {
  if (first == null || second == null) return null;
  if (first === second) return { value: first, consensus: 'unanimous', reviewerCount: 2 };
  return adjudication == null ? null : { value: adjudication, consensus: 'adjudicated', reviewerCount: 3 };
}
