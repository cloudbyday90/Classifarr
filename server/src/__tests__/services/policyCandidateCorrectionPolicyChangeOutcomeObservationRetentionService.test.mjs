/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import {
  PolicyCandidateCorrectionPolicyChangeOutcomeObservationRetentionService,
} from '../../services/policyCandidateCorrectionPolicyChangeOutcomeObservationRetentionService.mjs';

function createHarness({ fail = false } = {}) {
  const client = { query: jest.fn() };
  const persistence = {
    acquireLock: jest.fn().mockResolvedValue(undefined),
    deleteExpiredDecisionRecord: fail
      ? jest.fn().mockRejectedValue(new Error('database unavailable'))
      : jest.fn().mockResolvedValue(1),
    deleteExpired: fail
      ? jest.fn().mockRejectedValue(new Error('database unavailable'))
      : jest.fn().mockResolvedValue(1),
  };
  const db = { withTransaction: jest.fn(async callback => callback(client)) };
  const logger = { info: jest.fn(), error: jest.fn() };
  return {
    persistence,
    logger,
    service: new PolicyCandidateCorrectionPolicyChangeOutcomeObservationRetentionService({
      db,
      logger,
      persistence,
    }),
  };
}

describe('policy-change outcome observation retention service', () => {
  test('deletes only the expired fixed observation under the same transaction lock as starts', async () => {
    const { persistence, service } = createHarness();

    await expect(service.cleanup({ now: '2026-10-01T03:19:00.000Z' })).resolves.toEqual({
      statusId: 'completed',
      deletedDecisionRecordCount: 1,
      deletedObservationCount: 1,
    });
    expect(persistence.acquireLock).toHaveBeenCalledWith({ client: expect.any(Object) });
    expect(persistence.deleteExpiredDecisionRecord).toHaveBeenCalledWith({
      dbClient: expect.any(Object),
      now: '2026-10-01T03:19:00.000Z',
    });
    expect(persistence.deleteExpired).toHaveBeenCalledWith({
      dbClient: expect.any(Object),
      now: '2026-10-01T03:19:00.000Z',
    });
  });

  test('fails closed when retention cleanup cannot complete', async () => {
    const { logger, service } = createHarness({ fail: true });

    await expect(service.cleanup()).resolves.toEqual({
      statusId: 'failed_rolled_back',
      deletedDecisionRecordCount: 0,
      deletedObservationCount: 0,
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Policy-change outcome observation retention cleanup failed',
      expect.objectContaining({ error: 'database unavailable' }),
    );
  });
});
