/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createPolicyCandidateContrastiveOutcomeMetricsService,
} from '../../services/policyCandidateContrastiveOutcomeMetricsService.mjs';

describe('policyCandidateContrastiveOutcomeMetricsService', () => {
  test('loads a bounded completed-day aggregate and shapes the fixed report', async () => {
    const loadMetrics = jest.fn().mockResolvedValue([
      { contrastiveStatusId: 'leading_identity_match', observationCount: 2 },
    ]);
    const service = createPolicyCandidateContrastiveOutcomeMetricsService({
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
    expect(report.summary).toMatchObject({ observationCount: 2, attributedOutcomeCount: 0 });
  });
});
