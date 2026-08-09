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
  POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS,
  buildPolicyOperatorDecisionMetric,
  buildPolicyOperatorDecisionSignal,
  validatePolicyOperatorDecisionMetric,
} from '../../services/policyOperatorDecisionMetric.mjs';

const WINDOW_STARTED_AT = '2026-08-01T00:00:00.000Z';
const WINDOW_ENDED_AT = '2026-08-02T00:00:00.000Z';
const GENERATED_AT = '2026-08-03T00:00:00.000Z';

function buildMetric(overrides = {}) {
  return buildPolicyOperatorDecisionMetric({
    measurementScopeId: 'all_classification_history',
    windowStartedAt: WINDOW_STARTED_AT,
    windowEndedAt: WINDOW_ENDED_AT,
    generatedAt: GENERATED_AT,
    counts: {
      classifiedOutcomeCount: 100,
      openOperatorReviewCount: 20,
      pendingRetryCount: 3,
      automaticallyRoutedCount: 40,
      policyAutomaticOutcomeCount: 55,
    },
    ...overrides,
  });
}

describe('policy operator-decision metric', () => {
  test('builds a fingerprint-bound aggregate-only metric', () => {
    const metric = buildMetric();

    expect(metric).toEqual(expect.objectContaining({
      measurementScopeId: 'all_classification_history',
      window: expect.objectContaining({ durationSeconds: 86400 }),
      rates: { openOperatorDecisionRate: 0.2 },
      privacy: {
        aggregateOnly: true,
        includesRawClassificationIdentifiers: false,
        includesTitles: false,
        includesLibraryNames: false,
      },
      metricFingerprint: expect.objectContaining({ algorithm: 'sha256' }),
      validation: { ok: true, issueCount: 0, issues: [] },
    }));
  });

  test('fails validation when a bounded aggregate is altered after fingerprinting', () => {
    const metric = buildMetric();
    metric.counts.openOperatorReviewCount = 21;

    expect(validatePolicyOperatorDecisionMetric(metric)).toEqual(expect.objectContaining({
      ok: false,
      issues: expect.arrayContaining(['metric_fingerprint_invalid']),
    }));
  });

  test('fails validation when a derived rate is altered after metric generation', () => {
    const metric = buildMetric();
    metric.rates.openOperatorDecisionRate = 0.21;

    expect(validatePolicyOperatorDecisionMetric(metric)).toEqual(expect.objectContaining({
      ok: false,
      issues: expect.arrayContaining(['open_operator_decision_rate_mismatch']),
    }));
  });

  test('reports an improved open-decision rate only for comparable valid metrics', () => {
    const baselineMetric = buildMetric();
    const currentMetric = buildMetric({
      counts: {
        classifiedOutcomeCount: 100,
        openOperatorReviewCount: 10,
        pendingRetryCount: 2,
        automaticallyRoutedCount: 50,
        policyAutomaticOutcomeCount: 65,
      },
    });

    expect(buildPolicyOperatorDecisionSignal({ currentMetric, baselineMetric })).toEqual(
      expect.objectContaining({
        statusId: POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS.IMPROVED,
        reductionRate: 0.1,
        relativeReduction: 0.5,
      })
    );
  });

  test('rejects a baseline with a different aggregate scope', () => {
    const currentMetric = buildMetric();
    const baselineMetric = buildMetric({ measurementScopeId: 'library_subset' });

    expect(buildPolicyOperatorDecisionSignal({ currentMetric, baselineMetric })).toEqual(
      expect.objectContaining({
        statusId: POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS.BLOCKED,
        reasonId: 'metrics_not_comparable',
        comparabilityIssues: ['measurement_scope_mismatch'],
      })
    );
  });
});
