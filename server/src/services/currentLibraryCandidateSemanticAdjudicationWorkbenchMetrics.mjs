/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildCurrentLibraryCandidateSemanticOutcomeCalibrationEvaluation,
} from './currentLibraryCandidateSemanticOutcomeCalibrationEvaluation.mjs';

export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_METRICS_VERSION =
  'current_library.candidate_semantic_adjudication_workbench_metrics.v1';

export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_STATUS_IDS = Object.freeze({
  COLLECTING: 'collecting',
  NO_FROZEN_PROPOSAL: 'no_frozen_proposal',
  READY_FOR_HUMAN_REVIEW: 'ready_for_human_review',
});

export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_MINIMUM_RESOLVED_PROPOSAL_COUNT = 12;

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

function buildAuthority() {
  return Object.freeze({
    scope: 'aggregate_operator_outcome_evaluation_only',
    retainedItemAccess: false,
    automaticActions: Object.freeze({
      aiInvocation: false,
      learning: false,
      policyChange: false,
      ragTuning: false,
      retry: false,
      routing: false,
    }),
  });
}

/**
 * Shapes one newest frozen-proposal cohort. The later validated operator
 * destination is an observational reference, not a correctness oracle or
 * deployment approval.
 */
export function buildCurrentLibraryCandidateSemanticAdjudicationWorkbenchMetrics({ row = {} } = {}) {
  const proposalGroupCount = nonnegativeCount(row.proposalGroupCount);
  const comparisonCount = nonnegativeCount(row.comparisonCount);
  const proposalCount = boundedCount(row.proposalCount, comparisonCount);
  const abstainedCount = boundedCount(row.abstainedCount, comparisonCount - proposalCount);
  const responseRejectedCount = boundedCount(
    row.responseRejectedCount,
    comparisonCount - proposalCount - abstainedCount,
  );
  const resolvedProposalCount = boundedCount(row.resolvedProposalCount, proposalCount);
  const alignedProposalCount = boundedCount(row.alignedProposalCount, resolvedProposalCount);
  const semanticContextAvailableCount = boundedCount(
    row.semanticContextAvailableCount,
    comparisonCount,
  );
  const hasFrozenProposal = comparisonCount > 0 && proposalGroupCount > 0;
  const statusId = !hasFrozenProposal
    ? CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_STATUS_IDS.NO_FROZEN_PROPOSAL
    : resolvedProposalCount >=
      CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_MINIMUM_RESOLVED_PROPOSAL_COUNT
      ? CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_STATUS_IDS.READY_FOR_HUMAN_REVIEW
      : CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_STATUS_IDS.COLLECTING;

  return Object.freeze({
    authority: buildAuthority(),
    cohort: Object.freeze({
      alignedProposalCount,
      alternativeProposalCount: Math.max(0, resolvedProposalCount - alignedProposalCount),
      comparisonCount,
      proposalCount,
      resolvedProposalCount,
      semanticContextAvailableCount,
      abstainedCount,
      responseRejectedCount,
      agreementRatePercent: ratePercent(alignedProposalCount, resolvedProposalCount),
      pendingProposalCount: Math.max(0, proposalCount - resolvedProposalCount),
    }),
    semanticOutcomeCalibrationEvaluation:
      buildCurrentLibraryCandidateSemanticOutcomeCalibrationEvaluation({
        row,
        hasFrozenProposal,
        semanticContextAvailableCount,
      }),
    proposalGroupCount,
    referenceDecision: 'later_validated_operator_destination',
    status: Object.freeze({
      id: statusId,
      minimumResolvedProposalCount:
        CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_MINIMUM_RESOLVED_PROPOSAL_COUNT,
      automaticRoutingEligibility: false,
      policyChangeEligibility: false,
    }),
    version: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_WORKBENCH_METRICS_VERSION,
  });
}
