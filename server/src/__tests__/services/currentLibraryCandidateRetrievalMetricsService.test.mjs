/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createCurrentLibraryCandidateRetrievalMetricsService,
} from '../../services/currentLibraryCandidateRetrievalMetricsService.mjs';

describe('currentLibraryCandidateRetrievalMetricsService', () => {
  test('loads a bounded completed-day aggregate and shapes its report', async () => {
    const loadMetrics = jest.fn().mockResolvedValue({
      observationCount: 2,
      availableCount: 2,
      matchingObservationCount: 1,
    });
    const service = createCurrentLibraryCandidateRetrievalMetricsService({
      database: { query: jest.fn() },
      loadMetrics,
      now: () => new Date('2026-08-30T15:00:00.000Z'),
    });

    const report = await service.getSummary({ windowDays: 100 });

    expect(loadMetrics).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      days: 30,
      start: new Date('2026-07-31T00:00:00.000Z'),
      end: new Date('2026-08-30T00:00:00.000Z'),
    }));
    expect(report.retrieval).toMatchObject({ observationCount: 2, availabilityRatePercent: 100 });
  });
});
