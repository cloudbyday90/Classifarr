/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  asObject,
  isIsoTimestamp,
  normalizeString,
  sha256,
  stableStringify,
} from './policyReleaseAcceptanceShared.mjs';

const POLICY_OPERATOR_DECISION_METRIC_VERSION =
  'policy.operator_decision_metric.v1';

const POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS = Object.freeze({
  BLOCKED: 'blocked',
  IMPROVED: 'improved',
  INCREASED: 'increased',
  NOT_APPLICABLE: 'not_applicable',
  UNCHANGED: 'unchanged',
});

const SCOPE_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,119}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function asNonNegativeInteger(value) {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeCounts(counts = {}) {
  const source = asObject(counts);

  return {
    classifiedOutcomeCount: asNonNegativeInteger(source.classifiedOutcomeCount),
    openOperatorReviewCount: asNonNegativeInteger(source.openOperatorReviewCount),
    pendingRetryCount: asNonNegativeInteger(source.pendingRetryCount),
    automaticallyRoutedCount: asNonNegativeInteger(source.automaticallyRoutedCount),
    policyAutomaticOutcomeCount: asNonNegativeInteger(source.policyAutomaticOutcomeCount),
  };
}

function buildPolicyOperatorDecisionMetricFingerprintPayload(metric = {}) {
  const source = asObject(metric);

  return {
    version: POLICY_OPERATOR_DECISION_METRIC_VERSION,
    generatedAt: source.generatedAt || null,
    measurementScopeId: normalizeString(source.measurementScopeId, 120),
    window: {
      startedAt: source.window?.startedAt || null,
      endedAt: source.window?.endedAt || null,
      durationSeconds: asNonNegativeInteger(source.window?.durationSeconds),
    },
    counts: normalizeCounts(source.counts),
  };
}

function buildMetricFingerprint(metric = {}) {
  return sha256(stableStringify(buildPolicyOperatorDecisionMetricFingerprintPayload(metric)));
}

function calculateOpenOperatorDecisionRate(counts = {}) {
  const normalized = normalizeCounts(counts);

  if (!normalized.classifiedOutcomeCount) {
    return null;
  }

  return normalized.openOperatorReviewCount / normalized.classifiedOutcomeCount;
}

function buildPolicyOperatorDecisionMetric({
  measurementScopeId,
  windowStartedAt,
  windowEndedAt,
  counts = {},
  generatedAt = null,
} = {}) {
  const startedAt = windowStartedAt || null;
  const endedAt = windowEndedAt || null;
  const durationSeconds = isIsoTimestamp(startedAt) && isIsoTimestamp(endedAt)
    ? Math.floor((Date.parse(endedAt) - Date.parse(startedAt)) / 1000)
    : null;
  const metric = {
    version: POLICY_OPERATOR_DECISION_METRIC_VERSION,
    generatedAt: generatedAt || new Date().toISOString(),
    measurementScopeId: normalizeString(measurementScopeId, 120),
    window: {
      startedAt,
      endedAt,
      durationSeconds,
    },
    counts: normalizeCounts(counts),
    rates: {
      openOperatorDecisionRate: calculateOpenOperatorDecisionRate(counts),
    },
    privacy: {
      aggregateOnly: true,
      includesRawClassificationIdentifiers: false,
      includesTitles: false,
      includesLibraryNames: false,
    },
  };

  const metricFingerprint = buildMetricFingerprint(metric);
  const completedMetric = {
    ...metric,
    metricFingerprint: {
      algorithm: 'sha256',
      fingerprint: metricFingerprint,
    },
  };

  return {
    ...completedMetric,
    validation: validatePolicyOperatorDecisionMetric(completedMetric),
  };
}

function validatePolicyOperatorDecisionMetric(metric = {}) {
  const source = asObject(metric);
  const counts = normalizeCounts(source.counts);
  const issues = [];
  const startedAt = source.window?.startedAt;
  const endedAt = source.window?.endedAt;
  const durationSeconds = asNonNegativeInteger(source.window?.durationSeconds);

  if (source.version !== POLICY_OPERATOR_DECISION_METRIC_VERSION) {
    issues.push('unknown_metric_version');
  }

  if (!isIsoTimestamp(source.generatedAt)) {
    issues.push('invalid_generated_at');
  }

  if (!SCOPE_ID_PATTERN.test(normalizeString(source.measurementScopeId, 120))) {
    issues.push('invalid_measurement_scope');
  }

  if (!isIsoTimestamp(startedAt) || !isIsoTimestamp(endedAt) ||
    Date.parse(endedAt) <= Date.parse(startedAt)) {
    issues.push('invalid_measurement_window');
  } else if (durationSeconds !== Math.floor((Date.parse(endedAt) - Date.parse(startedAt)) / 1000)) {
    issues.push('measurement_window_duration_mismatch');
  }

  if (Object.values(counts).some(value => value === null)) {
    issues.push('invalid_metric_count');
  }

  if (source.rates?.openOperatorDecisionRate !== calculateOpenOperatorDecisionRate(counts)) {
    issues.push('open_operator_decision_rate_mismatch');
  }

  if (
    counts.classifiedOutcomeCount !== null &&
    (
      counts.openOperatorReviewCount > counts.classifiedOutcomeCount ||
      counts.pendingRetryCount > counts.classifiedOutcomeCount ||
      counts.automaticallyRoutedCount > counts.classifiedOutcomeCount ||
      counts.policyAutomaticOutcomeCount > counts.classifiedOutcomeCount
    )
  ) {
    issues.push('metric_count_exceeds_classified_outcomes');
  }

  if (
    source.privacy?.aggregateOnly !== true ||
    source.privacy?.includesRawClassificationIdentifiers !== false ||
    source.privacy?.includesTitles !== false ||
    source.privacy?.includesLibraryNames !== false
  ) {
    issues.push('privacy_boundary_invalid');
  }

  const fingerprint = normalizeString(source.metricFingerprint?.fingerprint, 64).toLowerCase();
  if (
    source.metricFingerprint?.algorithm !== 'sha256' ||
    !SHA256_PATTERN.test(fingerprint) ||
    fingerprint !== buildMetricFingerprint(source)
  ) {
    issues.push('metric_fingerprint_invalid');
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyOperatorDecisionSignal({
  currentMetric = null,
  baselineMetric = null,
} = {}) {
  if (!currentMetric) {
    return {
      statusId: POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS.NOT_APPLICABLE,
      reasonId: 'current_metric_missing',
      message: 'No current aggregate operator-decision metric was supplied.',
    };
  }

  const currentValidation = validatePolicyOperatorDecisionMetric(currentMetric);
  if (!currentValidation.ok) {
    return {
      statusId: POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS.BLOCKED,
      reasonId: 'current_metric_invalid',
      message: 'The current operator-decision metric is invalid.',
      validation: currentValidation,
    };
  }

  if (!baselineMetric) {
    return {
      statusId: POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS.NOT_APPLICABLE,
      reasonId: 'baseline_metric_missing',
      message: 'A comparable baseline metric is required before a decision-reduction claim can be made.',
      currentMetric,
    };
  }

  const baselineValidation = validatePolicyOperatorDecisionMetric(baselineMetric);
  if (!baselineValidation.ok) {
    return {
      statusId: POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS.BLOCKED,
      reasonId: 'baseline_metric_invalid',
      message: 'The baseline operator-decision metric is invalid.',
      validation: baselineValidation,
    };
  }

  const comparabilityIssues = [];
  if (currentMetric.measurementScopeId !== baselineMetric.measurementScopeId) {
    comparabilityIssues.push('measurement_scope_mismatch');
  }
  if (currentMetric.version !== baselineMetric.version) {
    comparabilityIssues.push('metric_version_mismatch');
  }
  if (currentMetric.window?.durationSeconds !== baselineMetric.window?.durationSeconds) {
    comparabilityIssues.push('measurement_window_duration_mismatch');
  }

  if (comparabilityIssues.length > 0) {
    return {
      statusId: POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS.BLOCKED,
      reasonId: 'metrics_not_comparable',
      message: 'The current and baseline metrics do not use the same bounded measurement contract.',
      comparabilityIssues,
    };
  }

  const currentRate = calculateOpenOperatorDecisionRate(currentMetric.counts);
  const baselineRate = calculateOpenOperatorDecisionRate(baselineMetric.counts);
  if (currentRate === null || baselineRate === null) {
    return {
      statusId: POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS.NOT_APPLICABLE,
      reasonId: 'insufficient_classification_volume',
      message: 'Both metrics need at least one classified outcome before a decision-rate comparison is meaningful.',
      currentMetric,
      baselineMetric,
    };
  }

  const rateDelta = currentRate - baselineRate;
  const reductionRate = baselineRate - currentRate;
  const relativeReduction = baselineRate === 0 ? null : reductionRate / baselineRate;
  const statusId = rateDelta < 0
    ? POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS.IMPROVED
    : rateDelta > 0
      ? POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS.INCREASED
      : POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS.UNCHANGED;

  return {
    statusId,
    reasonId: 'comparable_metrics',
    message: statusId === POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS.IMPROVED
      ? 'The open operator-decision rate decreased against the comparable baseline.'
      : statusId === POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS.INCREASED
        ? 'The open operator-decision rate increased against the comparable baseline and needs review.'
        : 'The open operator-decision rate is unchanged against the comparable baseline.',
    baseline: {
      metricFingerprint: baselineMetric.metricFingerprint.fingerprint,
      openOperatorDecisionRate: baselineRate,
    },
    current: {
      metricFingerprint: currentMetric.metricFingerprint.fingerprint,
      openOperatorDecisionRate: currentRate,
    },
    reductionRate,
    relativeReduction,
  };
}

export {
  POLICY_OPERATOR_DECISION_METRIC_VERSION,
  POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS,
  buildPolicyOperatorDecisionMetric,
  buildPolicyOperatorDecisionMetricFingerprintPayload,
  buildPolicyOperatorDecisionSignal,
  calculateOpenOperatorDecisionRate,
  validatePolicyOperatorDecisionMetric,
};
