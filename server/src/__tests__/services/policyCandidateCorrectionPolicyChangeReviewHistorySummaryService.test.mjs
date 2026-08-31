/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  PolicyCandidateCorrectionPolicyChangeReviewHistorySummaryValidationError,
  createPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryService,
} from '../../services/policyCandidateCorrectionPolicyChangeReviewHistorySummaryService.mjs';

function createHarness() {
  const db = { query: jest.fn() };
  const persistence = {
    readControl: jest.fn().mockResolvedValue({ started_at: '2026-01-01T00:00:00.000Z' }),
    readAggregates: jest.fn().mockResolvedValue([]),
  };
  return {
    persistence,
    service: createPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryService({ db, persistence }),
  };
}

describe('policy-change review history summary service', () => {
  test('reads only server-selected completed aggregate periods', async () => {
    const { persistence, service } = createHarness();

    const result = await service.getReviewHistorySummary({
      actorId: 7,
      now: '2026-08-31T12:00:00.000Z',
    });

    expect(result).toEqual(expect.objectContaining({ statusId: 'available', historyAvailable: true }));
    expect(persistence.readControl).toHaveBeenCalledWith({ dbClient: expect.any(Object) });
    expect(persistence.readAggregates).toHaveBeenCalledWith(expect.objectContaining({
      dbClient: expect.any(Object),
      periodStarts: expect.arrayContaining([expect.stringMatching(/^2026-\d{2}-\d{2}$/u)]),
    }));
    expect(persistence.readAggregates.mock.calls[0][0].periodStarts).toHaveLength(6);
    expect(JSON.stringify(result)).not.toContain('actorId');
    expect(JSON.stringify(result)).not.toContain('startedAt');
  });

  test('fails closed when the collection control is missing or the actor is invalid', async () => {
    const { persistence, service } = createHarness();
    persistence.readControl.mockResolvedValue(null);

    await expect(service.getReviewHistorySummary({ actorId: 7 }))
      .rejects.toBeInstanceOf(PolicyCandidateCorrectionPolicyChangeReviewHistorySummaryValidationError);
    await expect(service.getReviewHistorySummary({ actorId: 0 }))
      .rejects.toBeInstanceOf(PolicyCandidateCorrectionPolicyChangeReviewHistorySummaryValidationError);
  });
});
