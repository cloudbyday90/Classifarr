/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const softReviewReasons = new Set(['weak_evidence_primary', 'weak_evidence_overlap']);

/** Comparison may resolve these server-owned reasons; this is never routing authority. */
export function isLearnedEvidenceSoftReview(reason) {
  return softReviewReasons.has(reason);
}
