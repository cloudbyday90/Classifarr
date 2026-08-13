/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  loadCandidateBoundVerificationDailyOutcomeMetrics,
} from '../services/classificationCandidateBoundVerificationMetricsRepository.mjs';

describe('classificationCandidateBoundVerificationMetricsRepository', () => {
  test('queries only the versioned status projection over a bounded range', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [{ observed_on: '2026-08-12', status_id: 'confirmed', outcome_count: '3' }],
      }),
    };
    const previousStart = new Date('2026-08-01T00:00:00.000Z');
    const currentEnd = new Date('2026-08-15T00:00:00.000Z');

    const rows = await loadCandidateBoundVerificationDailyOutcomeMetrics(db, {
      previousStart,
      currentEnd,
    });

    expect(rows).toEqual([
      { observedOn: '2026-08-12', statusId: 'confirmed', outcomeCount: 3 },
    ]);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain("candidate_bound_verification,status_id");
    expect(sql).toContain('COUNT(*)::bigint');
    expect(sql).not.toContain('title');
    expect(sql).not.toContain('provider');
    expect(sql).not.toContain('response');
    expect(params).toEqual([
      previousStart.toISOString(),
      currentEnd.toISOString(),
      'classification.candidate_bound_verification.v1',
      expect.arrayContaining(['confirmed', 'abstained']),
    ]);
  });

  test('fails closed before issuing a malformed aggregate query', async () => {
    const db = { query: jest.fn() };

    await expect(loadCandidateBoundVerificationDailyOutcomeMetrics(db, {
      previousStart: new Date('2026-08-15T00:00:00.000Z'),
      currentEnd: new Date('2026-08-01T00:00:00.000Z'),
    })).rejects.toThrow('valid aggregate observation range');

    expect(db.query).not.toHaveBeenCalled();
  });
});
