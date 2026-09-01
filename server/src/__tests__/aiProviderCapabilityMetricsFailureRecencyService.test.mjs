/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createAiProviderCapabilityMetricsFailureRecencyService,
} from '../services/aiProviderCapabilityMetricsFailureRecencyService.mjs';

describe('aiProviderCapabilityMetricsFailureRecencyService', () => {
  test('owns the server-defined completed UTC-day window and returns a bounded recency band', async () => {
    const database = { query: jest.fn() };
    const loadRecency = jest.fn().mockResolvedValue([
      { period_id: 'baseline', persistence_failure_count: '1' },
      { period_id: 'previous', persistence_failure_count: '1' },
      { period_id: 'current', persistence_failure_count: '0' },
    ]);
    const service = createAiProviderCapabilityMetricsFailureRecencyService({
      database,
      loadRecency,
      now: () => new Date('2026-09-01T12:00:00.000Z'),
    });

    await expect(service.getReport()).resolves.toMatchObject({
      recency: { id: 'cleared_for_one_completed_day', completedDaysSinceLastWarning: 1 },
      status: { id: 'cleared_for_one_completed_day' },
    });
    expect(loadRecency).toHaveBeenCalledWith(database, expect.objectContaining({
      days: 1,
      periodCount: 3,
      periods: expect.arrayContaining([
        expect.objectContaining({ id: 'current', start: new Date('2026-08-31T00:00:00.000Z'), end: new Date('2026-09-01T00:00:00.000Z') }),
      ]),
    }));
  });
});
