/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  AI_PROVIDER_CAPABILITY_METRICS_FAILURE_BREAKDOWN_VERSION,
  buildAiProviderCapabilityMetricsFailureBreakdownReport,
} from '../services/aiProviderCapabilityMetricsFailureBreakdown.mjs';
import {
  buildAiProviderCapabilityMetricsHealthWindow,
} from '../services/aiProviderCapabilityMetricsHealth.mjs';

describe('aiProviderCapabilityMetricsFailureBreakdown', () => {
  test('returns fixed stage and SQLSTATE-category counts without source diagnostics', () => {
    const report = buildAiProviderCapabilityMetricsFailureBreakdownReport({
      row: {
        total_failure_count: '3',
        metric_persistence_write_count: '2',
        sqlstate_connection_exception_count: '1',
        sqlstate_not_available_count: '1',
        provider_id: 'private-provider',
        model: 'private-model',
        message: 'postgres://private-endpoint must not render',
      },
      window: buildAiProviderCapabilityMetricsHealthWindow({
        now: new Date('2026-09-01T12:00:00.000Z'),
      }),
    });

    expect(report).toMatchObject({
      version: AI_PROVIDER_CAPABILITY_METRICS_FAILURE_BREAKDOWN_VERSION,
      window: { hours: 24 },
      totalFailureCount: '3',
      safeCategoryFailureCount: '2',
      uncategorizedFailureCount: '1',
      status: { id: 'partial' },
      stages: [
        { id: 'metric_persistence_write', count: '2' },
      ],
    });
    expect(report.sqlstateCategories).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'connection_exception', count: '1' }),
      expect.objectContaining({ id: 'not_available', count: '1' }),
    ]));
    expect(JSON.stringify(report)).not.toContain('private-provider');
    expect(JSON.stringify(report)).not.toContain('private-model');
    expect(JSON.stringify(report)).not.toContain('private-endpoint');
  });

  test('marks historical warnings without category metadata as pending instead of guessing', () => {
    const report = buildAiProviderCapabilityMetricsFailureBreakdownReport({
      row: { total_failure_count: '1' },
      window: buildAiProviderCapabilityMetricsHealthWindow({
        now: new Date('2026-09-01T12:00:00.000Z'),
      }),
    });

    expect(report).toMatchObject({
      safeCategoryFailureCount: '0',
      uncategorizedFailureCount: '1',
      status: { id: 'awaiting_safe_categories' },
    });
  });
});
