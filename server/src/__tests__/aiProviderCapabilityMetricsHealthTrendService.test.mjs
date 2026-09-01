/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createAiProviderCapabilityMetricsHealthTrendService,
} from '../services/aiProviderCapabilityMetricsHealthTrendService.mjs';

describe('aiProviderCapabilityMetricsHealthTrendService', () => {
  test('owns the fixed completed windows and returns a status-only trend', async () => {
    const database = { query: jest.fn() };
    const loadTrend = jest.fn().mockResolvedValue([
      { period_id: 'baseline', active_metric_stream_count: '1', persistence_failure_count: '0' },
      { period_id: 'previous', active_metric_stream_count: '1', persistence_failure_count: '0' },
      { period_id: 'current', active_metric_stream_count: '1', persistence_failure_count: '1' },
    ]);
    const service = createAiProviderCapabilityMetricsHealthTrendService({
      database,
      loadTrend,
      now: () => new Date('2026-09-01T12:00:00.000Z'),
    });

    await expect(service.getReport()).resolves.toMatchObject({
      window: { days: 1, periodCount: 3 },
      status: { id: 'newly_observed_persistence_failures' },
    });
    expect(loadTrend).toHaveBeenCalledWith(database, expect.objectContaining({
      days: 1,
      periodCount: 3,
      periods: expect.arrayContaining([
        expect.objectContaining({ id: 'baseline' }),
        expect.objectContaining({ id: 'previous' }),
        expect.objectContaining({ id: 'current' }),
      ]),
    }));
  });
});
