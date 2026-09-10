/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildPolicyCandidateEvidenceOfflineSignalMetrics,
} from './policyCandidateEvidenceOfflineEvaluationMetrics.mjs';
import {
  buildPolicyConfirmationEvidenceConfidenceInterval,
} from './policyConfirmationEvidenceConfidence.mjs';

function percent(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function buildRate(numeratorCount, denominatorCount) {
  return Object.freeze({
    confidenceInterval: buildPolicyConfirmationEvidenceConfidenceInterval({
      observationCount: denominatorCount,
      successCount: numeratorCount,
    }),
    denominatorCount,
    numeratorCount,
    ratePercent: percent(numeratorCount, denominatorCount),
  });
}

function buildComparison(rows, signalId) {
  const metrics = buildPolicyCandidateEvidenceOfflineSignalMetrics({ rows, signalId });
  return Object.freeze({
    decisionAgreement: buildRate(metrics.agreementCount, metrics.evaluatedFixtureCount),
    disagreementCount: metrics.evaluatedFixtureCount - metrics.agreementCount,
    evaluatedFixtureCount: metrics.evaluatedFixtureCount,
    nonAbstentionCoverage: buildRate(
      metrics.evaluatedFixtureCount - metrics.abstentionCount,
      metrics.evaluatedFixtureCount,
    ),
    reviewProposal: Object.freeze({
      falseNegativeCount: metrics.falseNegativeCount,
      falsePositiveCount: metrics.falsePositiveCount,
      precision: buildRate(metrics.truePositiveCount, metrics.predictedReviewCount),
      recall: buildRate(metrics.truePositiveCount, metrics.referenceReviewCount),
      referenceReviewCount: metrics.referenceReviewCount,
      semanticReviewProposalCount: metrics.predictedReviewCount,
      truePositiveCount: metrics.truePositiveCount,
    }),
  });
}

function normalizedTags(row) {
  return [...new Set((Array.isArray(row?.tags) ? row.tags : [])
    .filter((tag) => typeof tag === 'string'))].sort();
}

function buildStratumSummaries(rows, signalId) {
  const tagIds = [...new Set(rows.flatMap(normalizedTags))].sort();
  return Object.freeze(tagIds.map((stratumId) => {
    const stratumRows = rows.filter((row) => normalizedTags(row).includes(stratumId));
    return Object.freeze({
      comparison: buildComparison(stratumRows, signalId),
      fixtureCount: stratumRows.length,
      stratumId,
    });
  }));
}

function buildReferenceReview(referenceSet) {
  const consensusCounts = referenceSet?.summary?.consensusCounts;
  const labelledFixtureCount = referenceSet?.summary?.labelledFixtureCount;
  const adjudicatedFixtureCount = Number.isSafeInteger(consensusCounts?.adjudicated)
    ? consensusCounts.adjudicated
    : 0;
  const unanimousFixtureCount = Number.isSafeInteger(consensusCounts?.unanimous)
    ? consensusCounts.unanimous
    : 0;
  const total = Number.isSafeInteger(labelledFixtureCount) ? labelledFixtureCount : 0;
  return Object.freeze({
    adjudicatedFixtureCount,
    reviewerDisagreement: buildRate(adjudicatedFixtureCount, total),
    unanimousFixtureCount,
  });
}

/**
 * Produces a content-free comparison and fixed stratum summaries for one
 * categorical evidence representation. Rows may contain only decisions and
 * tag IDs; source adapters retain fixture identities and every raw artifact.
 */
export function buildPolicyCandidateSemanticEvaluationAggregateReport({
  referenceSet,
  rows = [],
  signalId,
} = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return Object.freeze({
    comparison: buildComparison(safeRows, signalId),
    coverageByStratum: buildStratumSummaries(safeRows, signalId),
    referenceReview: buildReferenceReview(referenceSet),
  });
}
