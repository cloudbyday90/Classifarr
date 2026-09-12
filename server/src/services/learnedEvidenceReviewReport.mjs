/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { LEARNED_EVIDENCE_REVIEW_VERSION } from './learnedEvidenceReviewResolver.mjs';

/** Paired counts only; labels are observed placements, not correctness judgments. */
export function summarizeLearnedEvidenceReviews(rows) {
  const evaluated = rows.filter(row => row.generated?.learnedReview?.version === LEARNED_EVIDENCE_REVIEW_VERSION);
  const resolved = evaluated.filter(row => row.generated.learnedReview.wouldResolve);
  const added = resolved.filter(row => !row.generated.consensusEligible);
  const agrees = row => row.sample.observedLibraryIds.includes(row.generated.destinationId);
  const reasons = evaluated.map(row => row.generated.learnedReview.reason);
  return { version: LEARNED_EVIDENCE_REVIEW_VERSION, evaluated: evaluated.length,
    wouldResolve: resolved.length, wouldRetainReview: evaluated.length - resolved.length,
    placementAgreement: resolved.filter(agrees).length, placementDisagreement: resolved.filter(row => !agrees(row)).length,
    additionalResolutions: added.length, additionalPlacementAgreement: added.filter(agrees).length,
    additionalPlacementDisagreement: added.filter(row => !agrees(row)).length,
    baselineOnly: evaluated.filter(row => row.generated.consensusEligible && !row.generated.learnedReview.wouldResolve).length,
    both: resolved.length - added.length,
    policyLeaderDisagreement: resolved.filter(row => row.generated.destinationId !== row.prepared.policyResult.ranked[0]?.library_id).length,
    reasons: Object.fromEntries([...new Set(reasons)].sort().map(reason => [reason, reasons.filter(value => value === reason).length])),
    calibrated: false, livePromotionAllowed: false };
}
