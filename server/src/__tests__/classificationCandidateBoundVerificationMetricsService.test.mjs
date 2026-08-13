/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createCandidateBoundVerificationMetricsService,
} from '../services/classificationCandidateBoundVerificationMetricsService.mjs';

describe('classificationCandidateBoundVerificationMetricsService', () => {
  test('loads status-only rows and builds a versioned summary', async () => {
    const database = { query: jest.fn() };
    const loadDailyOutcomeMetrics = jest.fn().mockResolvedValue([
      { observedOn: '2026-08-09', statusId: 'confirmed', outcomeCount: 20 },
      { observedOn: '2026-08-02', statusId: 'confirmed', outcomeCount: 20 },
    ]);
    const service = createCandidateBoundVerificationMetricsService({
      database,
      loadDailyOutcomeMetrics,
      now: () => new Date('2026-08-12T18:00:00.000Z'),
    });

    const summary = await service.getSummary({ windowDays: 7 });

    expect(loadDailyOutcomeMetrics).toHaveBeenCalledWith(database, expect.objectContaining({
      days: 7,
      previousStart: new Date('2026-07-29T00:00:00.000Z'),
      currentStart: new Date('2026-08-05T00:00:00.000Z'),
      currentEnd: new Date('2026-08-12T00:00:00.000Z'),
    }));
    expect(summary).toMatchObject({
      version: 'classification.candidate_bound_verification_metrics.v1',
      driftGuard: { statusId: 'stable' },
    });
  });
});
