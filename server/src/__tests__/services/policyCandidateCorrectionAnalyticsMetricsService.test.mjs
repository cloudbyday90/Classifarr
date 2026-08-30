/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createPolicyCandidateCorrectionAnalyticsMetricsService,
} from '../../services/policyCandidateCorrectionAnalyticsMetricsService.mjs';

describe('policyCandidateCorrectionAnalyticsMetricsService', () => {
  test('loads short and fixed long-horizon completed windows before building the aggregate report', async () => {
    const loadMetrics = jest.fn().mockResolvedValue([]);
    const service = createPolicyCandidateCorrectionAnalyticsMetricsService({
      database: { query: jest.fn() },
      loadMetrics,
      now: () => new Date('2026-08-30T18:30:00.000Z'),
    });

    const report = await service.getSummary({ windowDays: 7 });

    expect(report.version).toBe('policy.candidate_correction_analytics_metrics.v6');
    expect(report.longHorizonTrend).toMatchObject({
      current: { window: { days: 28 } },
      previous: { window: { days: 28 } },
    });
    expect(loadMetrics).toHaveBeenCalledTimes(4);
    expect(loadMetrics.mock.calls.map(([, window]) => window)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        start: new Date('2026-08-23T00:00:00.000Z'),
        end: new Date('2026-08-30T00:00:00.000Z'),
      }),
      expect.objectContaining({
        start: new Date('2026-08-16T00:00:00.000Z'),
        end: new Date('2026-08-23T00:00:00.000Z'),
      }),
      expect.objectContaining({
        start: new Date('2026-08-02T00:00:00.000Z'),
        end: new Date('2026-08-30T00:00:00.000Z'),
      }),
      expect.objectContaining({
        start: new Date('2026-07-05T00:00:00.000Z'),
        end: new Date('2026-08-02T00:00:00.000Z'),
      }),
    ]));
  });

  test('reuses the fixed long-horizon aggregate loads when the short view also requests 28 days', async () => {
    const loadMetrics = jest.fn().mockResolvedValue([]);
    const service = createPolicyCandidateCorrectionAnalyticsMetricsService({
      database: { query: jest.fn() },
      loadMetrics,
      now: () => new Date('2026-08-30T18:30:00.000Z'),
    });

    await service.getSummary({ windowDays: 28 });

    expect(loadMetrics).toHaveBeenCalledTimes(2);
  });
});
