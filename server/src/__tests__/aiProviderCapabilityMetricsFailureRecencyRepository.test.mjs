/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  LOAD_AI_PROVIDER_CAPABILITY_METRICS_FAILURE_RECENCY_SQL,
  loadAiProviderCapabilityMetricsFailureRecency,
} from '../services/aiProviderCapabilityMetricsFailureRecencyRepository.mjs';
import {
  buildAiProviderCapabilityMetricsHealthTrendWindow,
} from '../services/aiProviderCapabilityMetricsHealthTrend.mjs';
import {
  AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
} from '../services/aiProviderCapabilityMetricsLogging.mjs';

describe('aiProviderCapabilityMetricsFailureRecencyRepository', () => {
  test('uses fixed parameterized filters and returns only completed-window counts', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [{ period_id: 'current', persistence_failure_count: '1' }] }),
    };
    const window = buildAiProviderCapabilityMetricsHealthTrendWindow({
      now: new Date('2026-09-01T12:00:00.000Z'),
    });

    await expect(loadAiProviderCapabilityMetricsFailureRecency(database, window))
      .resolves.toEqual([{ period_id: 'current', persistence_failure_count: '1' }]);

    const [sql, params] = database.query.mock.calls[0];
    expect(sql).toBe(LOAD_AI_PROVIDER_CAPABILITY_METRICS_FAILURE_RECENCY_SQL);
    expect(sql).toContain('COUNT(error_log.created_at)::text AS persistence_failure_count');
    expect(sql).not.toContain('provider_id');
    expect(sql).not.toContain('model =');
    expect(sql).not.toContain('stack_trace');
    expect(sql).not.toContain('SELECT metadata');
    expect(params).toEqual([
      ...window.periods.flatMap(period => [period.start.toISOString(), period.end.toISOString()]),
      AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
      AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
      AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
    ]);
  });

  test('rejects non-adjacent or non-UTC-day windows before querying', async () => {
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

    await expect(loadAiProviderCapabilityMetricsFailureRecency(database, malformedWindow))
      .rejects.toThrow('fixed three-window capability-metrics failure-recency range');
    expect(database.query).not.toHaveBeenCalled();
  });
});
