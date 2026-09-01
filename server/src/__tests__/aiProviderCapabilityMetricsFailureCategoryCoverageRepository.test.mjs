/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE,
  AI_PROVIDER_CAPABILITY_METRICS_SQLSTATE_CATEGORY_IDS,
} from '../services/aiProviderCapabilityMetricsFailureCategories.mjs';
import {
  LOAD_AI_PROVIDER_CAPABILITY_METRICS_FAILURE_CATEGORY_COVERAGE_SQL,
  loadAiProviderCapabilityMetricsFailureCategoryCoverage,
} from '../services/aiProviderCapabilityMetricsFailureCategoryCoverageRepository.mjs';
import {
  buildAiProviderCapabilityMetricsHealthTrendWindow,
} from '../services/aiProviderCapabilityMetricsHealthTrend.mjs';
import {
  AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
} from '../services/aiProviderCapabilityMetricsLogging.mjs';

describe('aiProviderCapabilityMetricsFailureCategoryCoverageRepository', () => {
  test('uses fixed parameterized categories and returns only completed-window counts', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [{ period_id: 'current', total_failure_count: '1' }] }),
    };
    const window = buildAiProviderCapabilityMetricsHealthTrendWindow({
      now: new Date('2026-09-01T12:00:00.000Z'),
    });

    await expect(loadAiProviderCapabilityMetricsFailureCategoryCoverage(database, window))
      .resolves.toEqual([{ period_id: 'current', total_failure_count: '1' }]);

    const [sql, params] = database.query.mock.calls[0];
    expect(sql).toBe(LOAD_AI_PROVIDER_CAPABILITY_METRICS_FAILURE_CATEGORY_COVERAGE_SQL);
    expect(sql).toContain('COUNT(error_log.created_at)::text AS total_failure_count');
    expect(sql).toContain('safe_category_failure_count');
    expect(sql).toContain("error_log.metadata->>'capabilityMetricsFailureStage' = $10");
    expect(sql).not.toContain('provider_id');
    expect(sql).not.toContain('model =');
    expect(sql).not.toContain('stack_trace');
    expect(sql).not.toContain('SELECT metadata');
    expect(params).toEqual([
      ...window.periods.flatMap(period => [period.start.toISOString(), period.end.toISOString()]),
      AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
      AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
      AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
      AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE,
      ...AI_PROVIDER_CAPABILITY_METRICS_SQLSTATE_CATEGORY_IDS,
    ]);
  });

  test('rejects non-adjacent or caller-shaped windows before querying', async () => {
    const database = { query: jest.fn() };
    const window = buildAiProviderCapabilityMetricsHealthTrendWindow({
      now: new Date('2026-09-01T12:00:00.000Z'),
    });
    const malformedWindow = {
      ...window,
      periods: [
        ...window.periods.slice(0, 2),
        { ...window.periods[2], start: new Date('2026-08-31T01:00:00.000Z') },
      ],
    };

    await expect(loadAiProviderCapabilityMetricsFailureCategoryCoverage(database, malformedWindow))
      .rejects.toThrow('fixed three-window capability-metrics category-coverage range');
    expect(database.query).not.toHaveBeenCalled();
  });
});
