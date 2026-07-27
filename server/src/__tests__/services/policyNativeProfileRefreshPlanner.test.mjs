/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';

import {
  PolicyNativeProfileRefreshPlanner,
} from '../../services/policyNativeProfileRefreshPlanner.mjs';

describe('PolicyNativeProfileRefreshPlanner', () => {
  test('persists only valid server-derived requests and reports replay or per-library coalescing', async () => {
    const client = { query: jest.fn() };
    const dbClient = {
      withTransaction: jest.fn(callback => callback(client)),
    };
    const candidateRepository = {
      findCandidates: jest.fn().mockResolvedValue([
        {
          libraryId: 8,
          profileState: 'missing_profile',
          profileGeneratedAt: null,
          observedItemCount: 12,
          observedItemHighWaterMark: 91,
        },
        {
          libraryId: 9,
          profileState: 'stale_profile',
          profileGeneratedAt: '2026-07-18T12:00:00.000Z',
        },
      ]),
    };
    const enqueue = jest.fn()
      .mockResolvedValueOnce({ replayed: false, coalesced: false })
      .mockResolvedValueOnce({ replayed: false, coalesced: true });
    const logger = { info: jest.fn() };
    const planner = new PolicyNativeProfileRefreshPlanner({
      dbClient,
      candidateRepository,
      enqueue,
      loggerInstance: logger,
    });

    await expect(planner.run()).resolves.toMatchObject({
      statusId: 'completed',
      scanned: 2,
      eligible: 2,
      queued: 1,
      replayed: 0,
      coalesced: 1,
      invalid: 0,
    });
    expect(dbClient.withTransaction).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      client,
      record: expect.objectContaining({
        requestType: 'native_readiness',
        sourceSystem: 'policy_native_readiness_profile_refresh',
      }),
    }));
    expect(logger.info).toHaveBeenCalledWith(
      'Native policy profile refresh planning completed',
      expect.objectContaining({ queued: 1, coalesced: 1 }),
    );
  });

  test('does not open a write transaction when there is no stale native-policy library', async () => {
    const dbClient = { withTransaction: jest.fn() };
    const planner = new PolicyNativeProfileRefreshPlanner({
      dbClient,
      candidateRepository: { findCandidates: jest.fn().mockResolvedValue([]) },
      enqueue: jest.fn(),
      loggerInstance: { info: jest.fn() },
    });

    await expect(planner.run()).resolves.toMatchObject({
      scanned: 0,
      eligible: 0,
      queued: 0,
    });
    expect(dbClient.withTransaction).not.toHaveBeenCalled();
  });
});
