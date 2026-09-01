/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createAiProviderCapabilityMetricsFailureCategoryCoverageService,
} from '../services/aiProviderCapabilityMetricsFailureCategoryCoverageService.mjs';

describe('aiProviderCapabilityMetricsFailureCategoryCoverageService', () => {
  test('owns the server-defined completed UTC-day window and returns a bounded report', async () => {
    const database = { query: jest.fn() };
    const loadCoverage = jest.fn().mockResolvedValue([
      { period_id: 'baseline', total_failure_count: '0', safe_category_failure_count: '0' },
      { period_id: 'previous', total_failure_count: '1', safe_category_failure_count: '0' },
      { period_id: 'current', total_failure_count: '1', safe_category_failure_count: '1' },
    ]);
    const service = createAiProviderCapabilityMetricsFailureCategoryCoverageService({
      database,
      loadCoverage,
      now: () => new Date('2026-09-01T12:00:00.000Z'),
    });

    await expect(service.getReport()).resolves.toMatchObject({
      periods: expect.arrayContaining([
        expect.objectContaining({ id: 'current', safeCategoryCoveragePercent: '100' }),
      ]),
      status: { id: 'complete' },
    });
    expect(loadCoverage).toHaveBeenCalledWith(database, expect.objectContaining({
      days: 1,
      periodCount: 3,
      periods: expect.arrayContaining([
        expect.objectContaining({ id: 'current', start: new Date('2026-08-31T00:00:00.000Z'), end: new Date('2026-09-01T00:00:00.000Z') }),
      ]),
    }));
  });
});
