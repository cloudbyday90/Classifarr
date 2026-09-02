/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_EVALUATION_VERSION =
  'current_library.candidate_semantic_outcome_calibration_evaluation.v1';

export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_EVALUATION_STATUS_IDS =
  Object.freeze({
    NO_FROZEN_PROPOSAL: 'no_frozen_proposal',
    COLLECTING: 'collecting',
    READY_FOR_HUMAN_REVIEW: 'ready_for_human_review',
  });

export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_EVALUATION_MINIMUM_RESOLVED_PROPOSAL_COUNT = 12;

function nonnegativeCount(value) {
  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function boundedCount(value, maximum) {
  return Math.min(nonnegativeCount(value), Math.max(0, maximum));
}

function ratePercent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function evaluationArm(row, prefix, remainingComparisonCount) {
  const comparisonCount = boundedCount(row?.[`${prefix}ComparisonCount`], remainingComparisonCount);
  const proposalCount = boundedCount(row?.[`${prefix}ProposalCount`], comparisonCount);
  const resolvedProposalCount = boundedCount(row?.[`${prefix}ResolvedProposalCount`], proposalCount);
  const alignedProposalCount = boundedCount(row?.[`${prefix}AlignedProposalCount`], resolvedProposalCount);

  return Object.freeze({
    comparisonCount,
    proposalCount,
    resolvedProposalCount,
    alignedProposalCount,
    alternativeProposalCount: resolvedProposalCount - alignedProposalCount,
    pendingProposalCount: proposalCount - resolvedProposalCount,
    agreementRatePercent: ratePercent(alignedProposalCount, resolvedProposalCount),
  });
}

/**
 * Compares only two semantic-match-bearing arms from one frozen proposal
 * cohort. A later operator destination is an observational reference, not a
 * correctness label or authority to change policy, retrieval, or routing.
 */
export function buildCurrentLibraryCandidateSemanticOutcomeCalibrationEvaluation({
  row = {},
  hasFrozenProposal = false,
  semanticContextAvailableCount = 0,
} = {}) {
  let remainingComparisonCount = nonnegativeCount(semanticContextAvailableCount);
  const outcomeCalibrated = evaluationArm(row, 'outcomeCalibrated', remainingComparisonCount);
  remainingComparisonCount -= outcomeCalibrated.comparisonCount;
  const notOutcomeCalibrated = evaluationArm(row, 'notOutcomeCalibrated', remainingComparisonCount);
  remainingComparisonCount -= notOutcomeCalibrated.comparisonCount;
  const noSemanticMatchCount = boundedCount(row.noSemanticMatchComparisonCount, remainingComparisonCount);
  remainingComparisonCount -= noSemanticMatchCount;
  const notRecordedComparisonCount = boundedCount(row.notRecordedCalibrationComparisonCount, remainingComparisonCount);

  const bothArmsReady = outcomeCalibrated.resolvedProposalCount >=
    CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_EVALUATION_MINIMUM_RESOLVED_PROPOSAL_COUNT &&
    notOutcomeCalibrated.resolvedProposalCount >=
    CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_EVALUATION_MINIMUM_RESOLVED_PROPOSAL_COUNT;
  const statusId = !hasFrozenProposal
    ? CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_EVALUATION_STATUS_IDS.NO_FROZEN_PROPOSAL
    : bothArmsReady
      ? CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_EVALUATION_STATUS_IDS.READY_FOR_HUMAN_REVIEW
      : CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_EVALUATION_STATUS_IDS.COLLECTING;

  return Object.freeze({
    version: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_EVALUATION_VERSION,
    status: Object.freeze({
      id: statusId,
      minimumResolvedProposalCount:
        CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_EVALUATION_MINIMUM_RESOLVED_PROPOSAL_COUNT,
      automaticRoutingEligibility: false,
      policyChangeEligibility: false,
      ragTuningEligibility: false,
    }),
    arms: Object.freeze({
      outcomeCalibrated,
      notOutcomeCalibrated,
    }),
    noSemanticMatchCount,
    notRecordedComparisonCount,
  });
}
