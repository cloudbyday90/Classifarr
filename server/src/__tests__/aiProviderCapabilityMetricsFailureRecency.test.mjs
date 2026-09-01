/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  AI_PROVIDER_CAPABILITY_METRICS_FAILURE_RECENCY_VERSION,
  buildAiProviderCapabilityMetricsFailureRecencyReport,
} from '../services/aiProviderCapabilityMetricsFailureRecency.mjs';
import {
  buildAiProviderCapabilityMetricsHealthTrendWindow,
} from '../services/aiProviderCapabilityMetricsHealthTrend.mjs';

function buildWindow() {
  return buildAiProviderCapabilityMetricsHealthTrendWindow({
    now: new Date('2026-09-01T12:00:00.000Z'),
  });
}

describe('aiProviderCapabilityMetricsFailureRecency', () => {
  test('reports the latest completed warning band without returning source diagnostics', () => {
    const report = buildAiProviderCapabilityMetricsFailureRecencyReport({
      rows: [
        { period_id: 'baseline', persistence_failure_count: '1' },
        { period_id: 'previous', persistence_failure_count: '0' },
        {
          period_id: 'current',
          persistence_failure_count: '2',
          provider: 'private-provider',
          model: 'private-model',
          message: 'postgres://private-endpoint must not render',
        },
      ],
      window: buildWindow(),
    });

    expect(report).toMatchObject({
      version: AI_PROVIDER_CAPABILITY_METRICS_FAILURE_RECENCY_VERSION,
      window: { days: 1, periodCount: 3 },
      periods: [
        { id: 'baseline', persistenceFailureCount: '1' },
        { id: 'previous', persistenceFailureCount: '0' },
        { id: 'current', persistenceFailureCount: '2' },
      ],
      recency: { id: 'warning_in_latest_completed_day', completedDaysSinceLastWarning: 0 },
      status: { id: 'warning_in_latest_completed_day' },
    });
    expect(JSON.stringify(report)).not.toContain('private-provider');
    expect(JSON.stringify(report)).not.toContain('private-model');
    expect(JSON.stringify(report)).not.toContain('private-endpoint');
  });

  test('distinguishes newly cleared, older-only, and absent completed warnings', () => {
    const newlyCleared = buildAiProviderCapabilityMetricsFailureRecencyReport({
      rows: [{ period_id: 'previous', persistence_failure_count: '1' }],
      window: buildWindow(),
    });
    const olderOnly = buildAiProviderCapabilityMetricsFailureRecencyReport({
      rows: [{ period_id: 'baseline', persistence_failure_count: '1' }],
      window: buildWindow(),
    });
    const absent = buildAiProviderCapabilityMetricsFailureRecencyReport({
      rows: [],
      window: buildWindow(),
    });

    expect(newlyCleared).toMatchObject({
      recency: { id: 'cleared_for_one_completed_day', completedDaysSinceLastWarning: 1 },
      status: { id: 'cleared_for_one_completed_day' },
    });
    expect(olderOnly).toMatchObject({
      recency: { id: 'older_completed_warning_only', completedDaysSinceLastWarning: 2 },
      status: { id: 'older_completed_warning_only' },
    });
    expect(absent).toMatchObject({
      recency: { id: 'no_completed_persistence_warnings', completedDaysSinceLastWarning: null },
      status: { id: 'no_completed_persistence_warnings' },
    });
  });
});
