/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import { createRouteSafetyReadinessService } from '../services/routeSafetyReadinessService.mjs';

describe('routeSafetyReadinessService', () => {
  test('loads a completed UTC-day aggregate without accepting a caller-selected range', async () => {
    const database = { query: jest.fn() };
    const loadPrimaryGateCounts = jest.fn().mockResolvedValue([
      { primary_gate_id: 'policy_confirmation_required', observation_count: '2' },
    ]);
    const service = createRouteSafetyReadinessService({
      database,
      loadPrimaryGateCounts,
      now: () => new Date('2026-08-31T13:30:00.000Z'),
    });

    const report = await service.getReport();

    expect(loadPrimaryGateCounts).toHaveBeenCalledWith(database, {
      days: 7,
      start: new Date('2026-08-24T00:00:00.000Z'),
      end: new Date('2026-08-31T00:00:00.000Z'),
    });
    expect(report).toMatchObject({
      observationCount: 2,
      status: { id: 'safeguards_observed' },
    });
  });
});
