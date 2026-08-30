/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_POLICY_REVIEW_READINESS_VERSION =
  'current_library.candidate_retrieval_policy_review_readiness.v1';

export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_POLICY_REVIEW_STATUS_IDS = Object.freeze({
  INSUFFICIENT_DATA: 'insufficient_data',
  CANDIDATE_SET_SUPPORTED: 'candidate_set_supported',
  CANDIDATE_SET_REVIEW_RECOMMENDED: 'candidate_set_review_recommended',
});

export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_POLICY_REVIEW_MINIMUM_APPLICABLE_DECISIONS = 20;
export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_POLICY_REVIEW_MINIMUM_OUTSIDE_CANDIDATE_DECISIONS = 3;
export const CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_POLICY_REVIEW_MINIMUM_OUTSIDE_CANDIDATE_RATE = 0.15;

function nonnegativeCount(value) {
  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function ratePercent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round(numerator / denominator * 1000) / 10;
}

/**
 * Turns existing aggregate attribution counts into a fixed, advisory-only
 * readiness result. It deliberately has no item, policy, candidate, provider,
 * model, or routing input and cannot grant any operational authority.
 */
export function buildCurrentLibraryCandidateRetrievalPolicyReviewReadiness({
  candidateSetSelectionOutcomeCount = 0,
  changedOutsideCandidateOutcomeCount = 0,
} = {}) {
  const normalizedCandidateSetSelectionOutcomeCount = nonnegativeCount(
    candidateSetSelectionOutcomeCount,
  );
  const normalizedChangedOutsideCandidateOutcomeCount = Math.min(
    Number.MAX_SAFE_INTEGER - normalizedCandidateSetSelectionOutcomeCount,
    nonnegativeCount(changedOutsideCandidateOutcomeCount),
  );
  const applicableDecisionCount =
    normalizedCandidateSetSelectionOutcomeCount + normalizedChangedOutsideCandidateOutcomeCount;
  const outsideCandidateRate = applicableDecisionCount > 0
    ? normalizedChangedOutsideCandidateOutcomeCount / applicableDecisionCount
    : 0;
  const hasSufficientData =
    applicableDecisionCount >= CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_POLICY_REVIEW_MINIMUM_APPLICABLE_DECISIONS;
  const reviewRecommended = hasSufficientData &&
    normalizedChangedOutsideCandidateOutcomeCount >=
      CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_POLICY_REVIEW_MINIMUM_OUTSIDE_CANDIDATE_DECISIONS &&
    outsideCandidateRate >=
      CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_POLICY_REVIEW_MINIMUM_OUTSIDE_CANDIDATE_RATE;
  const statusId = !hasSufficientData
    ? CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_POLICY_REVIEW_STATUS_IDS.INSUFFICIENT_DATA
    : (reviewRecommended
      ? CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_POLICY_REVIEW_STATUS_IDS.CANDIDATE_SET_REVIEW_RECOMMENDED
      : CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_POLICY_REVIEW_STATUS_IDS.CANDIDATE_SET_SUPPORTED);

  return Object.freeze({
    version: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_POLICY_REVIEW_READINESS_VERSION,
    statusId,
    applicableDecisionCount,
    minimumApplicableDecisionCount:
      CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_POLICY_REVIEW_MINIMUM_APPLICABLE_DECISIONS,
    outsideCandidateOutcomeCount: normalizedChangedOutsideCandidateOutcomeCount,
    minimumOutsideCandidateOutcomeCount:
      CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_POLICY_REVIEW_MINIMUM_OUTSIDE_CANDIDATE_DECISIONS,
    outsideCandidateRatePercent: ratePercent(
      normalizedChangedOutsideCandidateOutcomeCount,
      applicableDecisionCount,
    ),
    minimumOutsideCandidateRatePercent:
      CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_POLICY_REVIEW_MINIMUM_OUTSIDE_CANDIDATE_RATE * 100,
  });
}
