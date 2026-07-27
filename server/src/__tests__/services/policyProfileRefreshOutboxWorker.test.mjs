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
  PolicyProfileRefreshOutboxWorker,
} from '../../services/policyProfileRefreshOutboxWorker.mjs';

const claimToken = '3c3cdd11-8871-4f14-874a-8ea0b1e15a5d';

function createWorker({
  records = [],
  expired = 0,
  profileResult = {},
  profileError = null,
  storedProfile = null,
  storedProfileError = null,
  completeResult = true,
  failResult = { updated: true, terminal: false },
} = {}) {
  const client = { query: jest.fn() };
  const dbClient = {
    withTransaction: jest.fn(callback => callback(client)),
  };
  const outboxRepository = {
    closeExpiredClaims: jest.fn().mockResolvedValue(expired),
    claimBatch: jest.fn().mockResolvedValue(records),
    completeClaim: jest.fn().mockResolvedValue(completeResult),
    failClaim: jest.fn().mockResolvedValue(failResult),
  };
  const profileService = {
    getProfile: storedProfileError
      ? jest.fn().mockRejectedValue(storedProfileError)
      : jest.fn().mockResolvedValue(storedProfile),
    generateProfile: profileError
      ? jest.fn().mockRejectedValue(profileError)
      : jest.fn().mockResolvedValue(profileResult),
  };
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
  };
  const worker = new PolicyProfileRefreshOutboxWorker({
    dbClient,
    outboxRepository,
    profileService,
    createClaimToken: () => claimToken,
    loggerInstance: logger,
  });

  return { client, dbClient, logger, outboxRepository, profileService, worker };
}

describe('PolicyProfileRefreshOutboxWorker', () => {
  test('claims in a short transaction and completes a generated profile', async () => {
    const fixture = createWorker({
      expired: 1,
      records: [{ id: '91', libraryId: '8', attemptCount: 1 }],
    });

    const result = await fixture.worker.run();

    expect(result).toMatchObject({ claimed: 1, completed: 1, failed: 1 });
    expect(fixture.dbClient.withTransaction).toHaveBeenCalledTimes(1);
    expect(fixture.outboxRepository.claimBatch).toHaveBeenCalledWith(expect.objectContaining({
      client: fixture.client,
      claimToken,
      maxAttempts: 3,
    }));
    expect(fixture.profileService.generateProfile).toHaveBeenCalledWith('8');
    expect(fixture.outboxRepository.completeClaim).toHaveBeenCalledWith({
      client: fixture.dbClient,
      outboxId: '91',
      claimToken,
    });
  });

  test('completes an empty-library refresh without retrying it', async () => {
    const fixture = createWorker({
      records: [{ id: '91', libraryId: '8', attemptCount: 1 }],
      profileResult: null,
    });

    await expect(fixture.worker.run()).resolves.toMatchObject({
      completed: 1,
      completedWithoutProfile: 1,
      retried: 0,
    });
    expect(fixture.outboxRepository.failClaim).not.toHaveBeenCalled();
  });

  test('reschedules an unsuccessful profile refresh with bounded server-owned retry data', async () => {
    const fixture = createWorker({
      records: [{ id: '91', libraryId: '8', attemptCount: 1 }],
      profileError: new Error('database unavailable'),
    });

    await expect(fixture.worker.run()).resolves.toMatchObject({ retried: 1, failed: 0 });
    expect(fixture.outboxRepository.failClaim).toHaveBeenCalledWith({
      client: fixture.dbClient,
      outboxId: '91',
      claimToken,
      maxAttempts: 3,
      retryDelaySeconds: 60,
      failureCode: 'profile_refresh_execution_failed',
    });
    expect(fixture.logger.warn).toHaveBeenCalledWith(
      'Policy profile refresh attempt failed',
      expect.not.objectContaining({ error: 'database unavailable' }),
    );
  });

  test('counts a third failed attempt as terminal rather than scheduling a fourth', async () => {
    const fixture = createWorker({
      records: [{ id: '91', libraryId: '8', attemptCount: 3 }],
      profileError: new Error('database unavailable'),
      failResult: { updated: true, terminal: true },
    });

    await expect(fixture.worker.run()).resolves.toMatchObject({ retried: 0, failed: 1 });
    expect(fixture.outboxRepository.failClaim).toHaveBeenCalledWith(expect.objectContaining({
      retryDelaySeconds: 300,
    }));
  });

  test('does not overwrite another worker that completed an expired claim', async () => {
    const fixture = createWorker({
      records: [{ id: '91', libraryId: '8', attemptCount: 1 }],
      completeResult: false,
    });

    await expect(fixture.worker.run()).resolves.toMatchObject({
      completed: 0,
      lostClaims: 1,
    });
    expect(fixture.outboxRepository.failClaim).not.toHaveBeenCalled();
  });

  test('does not regenerate a native-readiness profile that another worker already made current', async () => {
    const fixture = createWorker({
      records: [{
        id: '91',
        libraryId: '8',
        attemptCount: 1,
        requestType: 'native_readiness',
      }],
      storedProfile: { last_generated_at: new Date().toISOString() },
    });

    await expect(fixture.worker.run()).resolves.toMatchObject({
      completed: 1,
      completedAlreadyCurrent: 1,
      completedWithoutProfile: 0,
    });
    expect(fixture.profileService.getProfile).toHaveBeenCalledWith('8');
    expect(fixture.profileService.generateProfile).not.toHaveBeenCalled();
  });

  test('regenerates a stale native-readiness profile after the claim is committed', async () => {
    const fixture = createWorker({
      records: [{
        id: '91',
        libraryId: '8',
        attemptCount: 1,
        requestType: 'native_readiness',
      }],
      storedProfile: { last_generated_at: '2026-06-01T00:00:00.000Z' },
    });

    await fixture.worker.run();

    expect(fixture.profileService.getProfile).toHaveBeenCalledWith('8');
    expect(fixture.profileService.generateProfile).toHaveBeenCalledWith('8');
  });
});
