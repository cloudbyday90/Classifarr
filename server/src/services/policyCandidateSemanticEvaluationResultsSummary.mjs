/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildPolicyCandidateEvidenceOfflineSignalMetrics,
} from './policyCandidateEvidenceOfflineEvaluationMetrics.mjs';
import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SIGNAL_IDS,
} from './policyCandidateEvidenceOfflineEvaluationSignalMapping.mjs';
import {
  buildPolicyCandidateSemanticEvaluationSource,
} from './policyCandidateSemanticEvaluationSource.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS,
} from './policyCandidateSemanticReferenceSetArtifact.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_CALIBRATION_STATUS_IDS,
  POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_AUTHORITY,
  POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS,
  POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_VERSION,
} from './policyCandidateSemanticEvaluationResultsSummaryContract.mjs';
import {
  buildPolicyConfirmationEvidenceConfidenceInterval,
} from './policyConfirmationEvidenceConfidence.mjs';

const SEMANTIC_SIGNAL_ID = POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SIGNAL_IDS
  .SEMANTIC_RETRIEVAL_PROPOSAL;

function cloneAuthority() {
  return Object.freeze({
    ...POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_AUTHORITY,
    automaticActions: Object.freeze({
      ...POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_AUTHORITY.automaticActions,
    }),
  });
}

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

function buildComparison(rows) {
  const metrics = buildPolicyCandidateEvidenceOfflineSignalMetrics({
    rows,
    signalId: SEMANTIC_SIGNAL_ID,
  });
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

function buildStratumSummaries(rows) {
  const tagIds = [...new Set(rows.flatMap((row) => row.tags))].sort();
  return Object.freeze(tagIds.map((stratumId) => {
    const stratumRows = rows.filter((row) => row.tags.includes(stratumId));
    return Object.freeze({
      comparison: buildComparison(stratumRows),
      fixtureCount: stratumRows.length,
      stratumId,
    });
  }));
}

function buildReferenceReview(referenceSet) {
  const consensusCounts = referenceSet.summary?.consensusCounts;
  const labelledFixtureCount = referenceSet.summary?.labelledFixtureCount;
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

function buildAvailableReport(source) {
  return Object.freeze({
    calibration: Object.freeze({
      available: false,
      reasonId: POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_CALIBRATION_STATUS_IDS
        .SCORELESS_CATEGORICAL_SIGNAL,
    }),
    comparison: buildComparison(source.rows),
    coverageByStratum: buildStratumSummaries(source.rows),
    referenceReview: buildReferenceReview(source.referenceSet),
  });
}

function buildResult({ report, statusId }) {
  return Object.freeze({
    authority: cloneAuthority(),
    report,
    status: Object.freeze({
      automaticRoutingEligibility: false,
      id: statusId,
      policyChangeEligibility: false,
    }),
    version: POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_VERSION,
  });
}

/**
 * Produces a content-free, descriptive report from a validated fixed semantic
 * evaluation and independently reviewed reference set. A categorical semantic
 * proposal has no probability, so this reports calibration as unavailable
 * rather than manufacturing a confidence claim. It never invokes AI/RAG,
 * retains source material, learns, changes policy, or routes media.
 */
export function buildPolicyCandidateSemanticEvaluationResultsSummary({
  fixtureDocument,
  referenceSetDocument,
  snapshotReport,
} = {}) {
  const source = buildPolicyCandidateSemanticEvaluationSource({
    fixtureDocument,
    referenceSetDocument,
    signalId: SEMANTIC_SIGNAL_ID,
    snapshotReport,
  });
  if (!source.ok) {
    return buildResult({
      report: null,
      statusId: POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS
        .EVALUATION_SOURCE_INVALID,
    });
  }
  if (source.referenceSet.status.id !==
      POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS.INDEPENDENTLY_LABELLED) {
    return buildResult({
      report: null,
      statusId: POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS
        .INDEPENDENT_REFERENCE_SET_REQUIRED,
    });
  }
  return buildResult({
    report: buildAvailableReport(source),
    statusId: POLICY_CANDIDATE_SEMANTIC_EVALUATION_RESULTS_SUMMARY_STATUS_IDS.SUMMARY_AVAILABLE,
  });
}
