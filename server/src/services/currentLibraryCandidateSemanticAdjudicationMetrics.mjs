/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_STATUS_IDS = Object.freeze({
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
  NOT_RECORDED: 'not_recorded',
});

const STATUS_IDS = Object.freeze([
  CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_STATUS_IDS.AVAILABLE,
  CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_STATUS_IDS.UNAVAILABLE,
  CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_STATUS_IDS.NOT_RECORDED,
]);

function nonnegativeCount(value) {
  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function boundedCount(value, maximum) {
  return Math.min(Math.max(0, maximum), nonnegativeCount(value));
}

function ratePercent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function fieldPrefix(statusId) {
  return {
    [CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_STATUS_IDS.AVAILABLE]: 'semanticAvailable',
    [CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_STATUS_IDS.UNAVAILABLE]: 'semanticUnavailable',
    [CURRENT_LIBRARY_CANDIDATE_SEMANTIC_ADJUDICATION_STATUS_IDS.NOT_RECORDED]: 'semanticNotRecorded',
  }[statusId];
}

function semanticOutcomeBucket({ row, statusId, remainingComparisonCount }) {
  const prefix = fieldPrefix(statusId);
  const comparisonCount = boundedCount(
    row?.[`${prefix}ComparisonCount`],
    remainingComparisonCount,
  );
  const proposalCount = boundedCount(row?.[`${prefix}ProposalCount`], comparisonCount);
  const resolvedProposalCount = boundedCount(
    row?.[`${prefix}ResolvedProposalCount`],
    proposalCount,
  );
  const agreedProposalCount = boundedCount(
    row?.[`${prefix}AgreedProposalCount`], resolvedProposalCount);

  return Object.freeze({
    statusId,
    comparisonCount,
    proposalCount,
    resolvedProposalCount,
    agreedProposalCount,
    alternativeProposalCount: resolvedProposalCount - agreedProposalCount,
    pendingProposalCount: proposalCount - resolvedProposalCount,
    agreementRatePercent: ratePercent(agreedProposalCount, resolvedProposalCount),
  });
}

/**
 * Projects aggregate-only candidate-adjudication outcomes into fixed semantic
 * context buckets. It never returns an item, library, model, prompt, response,
 * embedding, or provider identifier, and invalid aggregate counts fail closed
 * to a bounded value rather than creating a misleading rate.
 */
export function buildCurrentLibraryCandidateSemanticAdjudicationMetrics({
  row = {},
  observationCount = 0,
} = {}) {
  const comparisonCount = boundedCount(
    row.candidateAdjudicationComparisonCount,
    nonnegativeCount(observationCount),
  );
  const proposalCount = boundedCount(row.proposalCount, comparisonCount);
  const abstainedCount = boundedCount(
    row.candidateAdjudicationAbstainedCount,
    comparisonCount - proposalCount,
  );
  const responseRejectedCount = boundedCount(
    row.candidateAdjudicationResponseRejectedCount,
    comparisonCount - proposalCount - abstainedCount,
  );

  let remainingComparisonCount = comparisonCount;
  const semanticContext = Object.freeze(STATUS_IDS.map((statusId) => {
    const bucket = semanticOutcomeBucket({ row, statusId, remainingComparisonCount });
    remainingComparisonCount -= bucket.comparisonCount;
    return bucket;
  }));

  return Object.freeze({
    comparisonCount,
    proposalCount,
    abstainedCount,
    responseRejectedCount,
    unclassifiedComparisonCount: Math.max(
      0,
      comparisonCount - proposalCount - abstainedCount - responseRejectedCount,
    ),
    semanticContext,
  });
}
