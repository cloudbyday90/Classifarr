/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';

const AI_CLASSIFICATION_EVALUATION_TREND_BASELINE_VERSION =
  'classifarr.ai_classification_evaluation_trend_baseline.v1';
const EVALUATED_STATUS = 'evaluated';
const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_FIXTURE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SAFE_MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,255}$/;
const EVALUATION_SOURCES = new Set([
  'direct_response',
  'queued_decision_witness',
]);

class AiClassificationEvaluationTrendBaselineValidationError extends Error {
  constructor(issues) {
    super(`Invalid AI classification evaluation sweep report: ${issues.join('; ')}`);
    this.name = 'AiClassificationEvaluationTrendBaselineValidationError';
    this.issues = issues;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function cohortIdFor(parts) {
  return sha256(JSON.stringify(parts));
}

function isFingerprint(value) {
  return isRecord(value) && value.algorithm === 'sha256' &&
    typeof value.fingerprint === 'string' && SHA256_FINGERPRINT_PATTERN.test(value.fingerprint);
}

function projectFingerprint(value) {
  return {
    algorithm: value.algorithm,
    fingerprint: value.fingerprint,
  };
}

function projectEvaluatedRow(row, rowIndex, label, issues) {
  const evaluation = row?.evaluation;
  if (!isRecord(evaluation) || evaluation.status !== EVALUATED_STATUS) {
    return null;
  }

  const issuePrefix = `${label}.results[${rowIndex}].evaluation`;
  if (typeof evaluation.fixtureId !== 'string' ||
    !SAFE_FIXTURE_ID_PATTERN.test(evaluation.fixtureId)) {
    issues.push(`${issuePrefix}.fixtureId must be a bounded lowercase identifier`);
  }
  if (typeof row.model !== 'string' || !SAFE_MODEL_PATTERN.test(row.model)) {
    issues.push(`${label}.results[${rowIndex}].model must be a bounded model identifier`);
  }
  if (!EVALUATION_SOURCES.has(evaluation.evaluationSource)) {
    issues.push(`${issuePrefix}.evaluationSource is unsupported`);
  }
  if (!isRecord(evaluation.result) || typeof evaluation.result.passed !== 'boolean') {
    issues.push(`${issuePrefix}.result.passed must be boolean`);
  }

  const fingerprints = evaluation.fingerprints;
  for (const scope of ['fixture', 'policy', 'runtime', 'outcome']) {
    if (!isRecord(fingerprints) || !isFingerprint(fingerprints[scope])) {
      issues.push(`${issuePrefix}.fingerprints.${scope} must be a SHA-256 fingerprint`);
    }
  }

  if (issues.some(issue => issue.startsWith(issuePrefix) ||
    issue.startsWith(`${label}.results[${rowIndex}].model`))) {
    return null;
  }

  return {
    fixtureId: evaluation.fixtureId,
    model: row.model,
    evaluationSource: evaluation.evaluationSource,
    passed: evaluation.result.passed,
    fingerprints: Object.fromEntries(
      ['fixture', 'policy', 'runtime', 'outcome'].map(scope => [
        scope,
        projectFingerprint(fingerprints[scope]),
      ]),
    ),
  };
}

function createCohort(row) {
  const comparisonIdentity = [
    row.fixtureId,
    row.model,
    row.fingerprints.fixture.fingerprint,
  ];
  const strictIdentity = [
    ...comparisonIdentity,
    row.evaluationSource,
    row.fingerprints.policy.fingerprint,
    row.fingerprints.runtime.fingerprint,
  ];

  return {
    cohortId: cohortIdFor(strictIdentity),
    comparisonIdentity: JSON.stringify(comparisonIdentity),
    strictIdentity: JSON.stringify(strictIdentity),
    fixtureId: row.fixtureId,
    model: row.model,
    evaluationSource: row.evaluationSource,
    fingerprints: {
      fixture: row.fingerprints.fixture,
      policy: row.fingerprints.policy,
      runtime: row.fingerprints.runtime,
    },
    aggregate: {
      evaluatedCount: 0,
      passedCount: 0,
      failedCount: 0,
      outcomeFingerprints: new Map(),
    },
  };
}

function toPublicCohort(cohort) {
  const { aggregate } = cohort;
  const outcomeFingerprints = [...aggregate.outcomeFingerprints.entries()]
    .map(([fingerprint, count]) => ({ algorithm: 'sha256', fingerprint, count }))
    .sort((left, right) => left.fingerprint.localeCompare(right.fingerprint));

  return {
    cohortId: cohort.cohortId,
    fixtureId: cohort.fixtureId,
    model: cohort.model,
    evaluationSource: cohort.evaluationSource,
    fingerprints: cohort.fingerprints,
    aggregate: {
      evaluatedCount: aggregate.evaluatedCount,
      passedCount: aggregate.passedCount,
      failedCount: aggregate.failedCount,
      passRate: aggregate.passedCount / aggregate.evaluatedCount,
      outcomeFingerprints,
    },
  };
}

function comparePublicCohorts(left, right) {
  return left.cohortId.localeCompare(right.cohortId);
}

function indexCohorts(report, label) {
  const issues = [];
  if (!isRecord(report)) {
    throw new AiClassificationEvaluationTrendBaselineValidationError([`${label} must be an object`]);
  }
  if (!Array.isArray(report.results)) {
    throw new AiClassificationEvaluationTrendBaselineValidationError([`${label}.results must be an array`]);
  }

  const cohorts = new Map();
  let excludedRowCount = 0;
  let ungradedRowCount = 0;
  report.results.forEach((row, rowIndex) => {
    const evaluation = row?.evaluation;
    if (!isRecord(evaluation) || evaluation.status === 'not_requested') {
      excludedRowCount += 1;
      return;
    }
    if (evaluation.status !== EVALUATED_STATUS) {
      ungradedRowCount += 1;
      return;
    }
    const projected = projectEvaluatedRow(row, rowIndex, label, issues);
    if (!projected) {
      ungradedRowCount += 1;
      return;
    }

    const candidate = createCohort(projected);
    const cohort = cohorts.get(candidate.strictIdentity) ?? candidate;
    cohort.aggregate.evaluatedCount += 1;
    cohort.aggregate.passedCount += projected.passed ? 1 : 0;
    cohort.aggregate.failedCount += projected.passed ? 0 : 1;
    const outcomeFingerprint = projected.fingerprints.outcome.fingerprint;
    cohort.aggregate.outcomeFingerprints.set(
      outcomeFingerprint,
      (cohort.aggregate.outcomeFingerprints.get(outcomeFingerprint) ?? 0) + 1,
    );
    cohorts.set(candidate.strictIdentity, cohort);
  });

  if (issues.length > 0) {
    throw new AiClassificationEvaluationTrendBaselineValidationError(issues);
  }

  const publicCohorts = [...cohorts.values()].map(toPublicCohort).sort(comparePublicCohorts);
  const byComparisonIdentity = new Map();
  for (const cohort of publicCohorts) {
    const identity = JSON.stringify([
      cohort.fixtureId,
      cohort.model,
      cohort.fingerprints.fixture.fingerprint,
    ]);
    const existing = byComparisonIdentity.get(identity) ?? [];
    existing.push(cohort);
    byComparisonIdentity.set(identity, existing);
  }

  return {
    byComparisonIdentity,
    byStrictIdentity: new Map(publicCohorts.map(cohort => [cohort.cohortId, cohort])),
    evaluatedRowCount: publicCohorts.reduce(
      (total, cohort) => total + cohort.aggregate.evaluatedCount,
      0,
    ),
    excludedRowCount,
    totalRowCount: report.results.length,
    ungradedRowCount,
  };
}

function sameOutcomeDistribution(baseline, candidate) {
  return JSON.stringify(baseline.aggregate.outcomeFingerprints) ===
    JSON.stringify(candidate.aggregate.outcomeFingerprints);
}

function compareMatchingCohort(baseline, candidate) {
  const baselinePassRate = baseline.aggregate.passRate;
  const candidatePassRate = candidate.aggregate.passRate;
  let status = 'stable';
  if (candidatePassRate < baselinePassRate) {
    status = 'pass_rate_regressed';
  } else if (candidatePassRate > baselinePassRate) {
    status = 'pass_rate_improved';
  } else if (candidate.aggregate.evaluatedCount !== baseline.aggregate.evaluatedCount) {
    status = 'sample_size_changed';
  } else if (!sameOutcomeDistribution(baseline, candidate)) {
    status = 'outcome_distribution_changed';
  }

  return {
    cohortId: baseline.cohortId,
    status,
    humanReviewRequired: status !== 'stable',
    baseline,
    candidate,
  };
}

function normalizeReportFingerprint(value, report, label) {
  if (value === undefined || value === null) {
    return { algorithm: 'sha256', fingerprint: sha256(JSON.stringify(report)) };
  }
  if (!isFingerprint(value)) {
    throw new AiClassificationEvaluationTrendBaselineValidationError([
      `${label} report fingerprint must be a SHA-256 fingerprint`,
    ]);
  }
  return projectFingerprint(value);
}

function compareAiClassificationEvaluationSweepReports({
  baselineReport,
  candidateReport,
  baselineReportFingerprint,
  candidateReportFingerprint,
  createdAt = new Date().toISOString(),
} = {}) {
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) {
    throw new AiClassificationEvaluationTrendBaselineValidationError([
      'createdAt must be an ISO-8601 timestamp',
    ]);
  }

  const baseline = indexCohorts(baselineReport, 'baseline');
  const candidate = indexCohorts(candidateReport, 'candidate');
  const matching = [];
  const candidateOnly = [];
  const baselineOnly = [];
  const matchedCandidateIds = new Set();
  const matchedBaselineIds = new Set();

  for (const [cohortId, baselineCohort] of baseline.byStrictIdentity) {
    const candidateCohort = candidate.byStrictIdentity.get(cohortId);
    if (!candidateCohort) continue;
    matching.push(compareMatchingCohort(baselineCohort, candidateCohort));
    matchedBaselineIds.add(cohortId);
    matchedCandidateIds.add(cohortId);
  }

  for (const [cohortId, candidateCohort] of candidate.byStrictIdentity) {
    if (matchedCandidateIds.has(cohortId)) continue;
    const relatedBaseline = baseline.byComparisonIdentity.get(JSON.stringify([
      candidateCohort.fixtureId,
      candidateCohort.model,
      candidateCohort.fingerprints.fixture.fingerprint,
    ])) ?? [];
    candidateOnly.push({
      status: relatedBaseline.length > 0 ? 'context_changed' : 'candidate_only',
      humanReviewRequired: true,
      candidate: candidateCohort,
      relatedBaselineCohortIds: relatedBaseline.map(cohort => cohort.cohortId),
    });
  }

  for (const [cohortId, baselineCohort] of baseline.byStrictIdentity) {
    if (matchedBaselineIds.has(cohortId)) continue;
    const relatedCandidate = candidate.byComparisonIdentity.get(JSON.stringify([
      baselineCohort.fixtureId,
      baselineCohort.model,
      baselineCohort.fingerprints.fixture.fingerprint,
    ])) ?? [];
    baselineOnly.push({
      status: relatedCandidate.length > 0 ? 'context_changed' : 'baseline_only',
      humanReviewRequired: true,
      baseline: baselineCohort,
      relatedCandidateCohortIds: relatedCandidate.map(cohort => cohort.cohortId),
    });
  }

  matching.sort((left, right) => left.cohortId.localeCompare(right.cohortId));
  candidateOnly.sort((left, right) => left.candidate.cohortId.localeCompare(right.candidate.cohortId));
  baselineOnly.sort((left, right) => left.baseline.cohortId.localeCompare(right.baseline.cohortId));

  const regressionCount = matching.filter(item => item.status === 'pass_rate_regressed').length;
  const changedMatchingCount = matching.filter(item => item.status !== 'stable').length;
  const coverageDegraded = candidate.ungradedRowCount > 0 || baseline.ungradedRowCount > 0;
  const humanReviewRequired = regressionCount > 0 || changedMatchingCount > 0 ||
    candidateOnly.length > 0 || baselineOnly.length > 0 || coverageDegraded;

  return {
    version: AI_CLASSIFICATION_EVALUATION_TREND_BASELINE_VERSION,
    createdAt,
    authority: {
      scope: 'local_evaluation_review_only',
      automaticActions: {
        deployment: false,
        policyChange: false,
        release: false,
        routing: false,
      },
    },
    reports: {
      baseline: {
        contentFingerprint: normalizeReportFingerprint(
          baselineReportFingerprint,
          baselineReport,
          'baseline',
        ),
        evaluatedRowCount: baseline.evaluatedRowCount,
        excludedRowCount: baseline.excludedRowCount,
        totalRowCount: baseline.totalRowCount,
        ungradedRowCount: baseline.ungradedRowCount,
      },
      candidate: {
        contentFingerprint: normalizeReportFingerprint(
          candidateReportFingerprint,
          candidateReport,
          'candidate',
        ),
        evaluatedRowCount: candidate.evaluatedRowCount,
        excludedRowCount: candidate.excludedRowCount,
        totalRowCount: candidate.totalRowCount,
        ungradedRowCount: candidate.ungradedRowCount,
      },
    },
    summary: {
      baselineOnlyCount: baselineOnly.length,
      candidateOnlyCount: candidateOnly.length,
      changedMatchingCount,
      comparedCohortCount: matching.length,
      contextChangedCount: [...candidateOnly, ...baselineOnly]
        .filter(item => item.status === 'context_changed').length,
      coverageDegraded,
      humanReviewRequired,
      regressionCount,
      stableCount: matching.filter(item => item.status === 'stable').length,
      recommendation: humanReviewRequired
        ? 'human_review_required'
        : 'no_delta_detected_human_release_decision_still_required',
    },
    comparisons: {
      baselineOnly,
      candidateOnly,
      matching,
    },
  };
}

export {
  AI_CLASSIFICATION_EVALUATION_TREND_BASELINE_VERSION,
  AiClassificationEvaluationTrendBaselineValidationError,
  compareAiClassificationEvaluationSweepReports,
};
