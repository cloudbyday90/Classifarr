/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  AI_PROVIDER_CAPABILITY_METRICS_FAILURE_CATEGORY_COVERAGE_VERSION,
  buildAiProviderCapabilityMetricsFailureCategoryCoverageReport,
} from '../services/aiProviderCapabilityMetricsFailureCategoryCoverage.mjs';
import {
  buildAiProviderCapabilityMetricsHealthTrendWindow,
} from '../services/aiProviderCapabilityMetricsHealthTrend.mjs';

describe('aiProviderCapabilityMetricsFailureCategoryCoverage', () => {
  test('reports fixed completed-window coverage without source diagnostics', () => {
    const report = buildAiProviderCapabilityMetricsFailureCategoryCoverageReport({
      rows: [
        { period_id: 'baseline', total_failure_count: '1', safe_category_failure_count: '0' },
        { period_id: 'previous', total_failure_count: '2', safe_category_failure_count: '2' },
        {
          period_id: 'current',
          total_failure_count: '3',
          safe_category_failure_count: '2',
          provider: 'private-provider',
          model: 'private-model',
          message: 'postgres://private-endpoint must not render',
        },
      ],
      window: buildAiProviderCapabilityMetricsHealthTrendWindow({
        now: new Date('2026-09-01T12:00:00.000Z'),
      }),
    });

    expect(report).toMatchObject({
      version: AI_PROVIDER_CAPABILITY_METRICS_FAILURE_CATEGORY_COVERAGE_VERSION,
      window: { days: 1, periodCount: 3 },
      periods: [
        { id: 'baseline', totalFailureCount: '1', safeCategoryFailureCount: '0', safeCategoryCoveragePercent: '0' },
        { id: 'previous', totalFailureCount: '2', safeCategoryFailureCount: '2', safeCategoryCoveragePercent: '100' },
        { id: 'current', totalFailureCount: '3', safeCategoryFailureCount: '2', safeCategoryCoveragePercent: '67' },
      ],
      status: { id: 'partial' },
    });
    expect(JSON.stringify(report)).not.toContain('private-provider');
    expect(JSON.stringify(report)).not.toContain('private-model');
    expect(JSON.stringify(report)).not.toContain('private-endpoint');
  });

  test('treats no completed-window warning as not applicable instead of inferring coverage', () => {
    const report = buildAiProviderCapabilityMetricsFailureCategoryCoverageReport({
      rows: [],
      window: buildAiProviderCapabilityMetricsHealthTrendWindow({
        now: new Date('2026-09-01T12:00:00.000Z'),
      }),
    });

    expect(report).toMatchObject({
      periods: expect.arrayContaining([
        expect.objectContaining({ safeCategoryCoveragePercent: null }),
      ]),
      status: { id: 'no_completed_persistence_warnings' },
    });
  });
});
