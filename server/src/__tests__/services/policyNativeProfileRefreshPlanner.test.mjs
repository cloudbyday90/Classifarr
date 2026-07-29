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

const SOURCE_EVENT_ID = 'library-profile:8:stale_profile:2026-07-25T12:00:00.000Z';

function createCircuitRepository({
  circuit = null,
  failureTransition = {
    ready: true,
    opened: false,
    circuit: { circuitState: 'closed' },
  },
  probeTransition = {
    ready: true,
    circuit: { circuitState: 'half_open' },
  },
} = {}) {
  return {
    lock: jest.fn().mockResolvedValue(circuit),
    recordFailure: jest.fn().mockResolvedValue(failureTransition),
    startProbe: jest.fn().mockResolvedValue(probeTransition),
    deferProbe: jest.fn().mockResolvedValue({
      ready: true,
      circuit: { circuitState: 'open' },
    }),
  };
}

function createOpenCircuit({ nextProbeAt = '2026-07-28T14:00:00.000Z' } = {}) {
  return {
    circuitState: 'open',
    consecutiveFailureCount: 3,
    lastTerminalOutboxId: 93,
    lastFailureCode: 'profile_refresh_unknown_failed',
    openedAt: '2026-07-28T12:00:00.000Z',
    nextProbeAt,
    probeOutboxId: null,
  };
}

function createHalfOpenCircuit({ probeOutboxId = 94 } = {}) {
  return {
    circuitState: 'half_open',
    consecutiveFailureCount: 1,
    lastTerminalOutboxId: 93,
    lastFailureCode: 'profile_refresh_configuration_invalid',
    openedAt: '2026-07-28T12:00:00.000Z',
    nextProbeAt: null,
    probeOutboxId,
  };
}

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
      circuitRepository: createCircuitRepository(),
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
      circuitRepository: createCircuitRepository(),
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

  test('schedules one delayed successor when a terminal native refresh replays', async () => {
    const client = { query: jest.fn() };
    const enqueue = jest.fn()
      .mockResolvedValueOnce({
        outbox: { id: '91', processingState: 'failed' },
        replayed: true,
        coalesced: false,
      })
      .mockResolvedValueOnce({
        outbox: { id: '92', processingState: 'pending' },
        replayed: false,
        coalesced: false,
      });
    const failureRepository = {
      findHistory: jest.fn().mockResolvedValue({
        failedOutboxId: '91',
        failureCode: 'profile_refresh_execution_failed',
        failureCount: 2,
      }),
    };
    const planner = new PolicyNativeProfileRefreshPlanner({
      dbClient: { withTransaction: jest.fn(callback => callback(client)) },
      candidateRepository: {
        findCandidates: jest.fn().mockResolvedValue([{
          libraryId: 8,
          profileState: 'stale_profile',
          profileGeneratedAt: '2026-07-25T12:00:00.000Z',
        }]),
      },
      enqueue,
      failureRepository,
      circuitRepository: createCircuitRepository(),
      now: () => new Date('2026-07-26T00:00:00.000Z'),
      loggerInstance: { info: jest.fn() },
    });

    await expect(planner.run()).resolves.toMatchObject({
      queued: 0,
      replayed: 1,
      successorQueued: 1,
      successorReplayed: 0,
      successorCoalesced: 0,
      successorInvalid: 0,
    });
    expect(failureRepository.findHistory).toHaveBeenCalledWith({
      client,
      libraryId: 8,
      sourceEventId: 'library-profile:8:stale_profile:2026-07-25T12:00:00.000Z',
    });
    expect(enqueue.mock.calls[1][0].record).toEqual(expect.objectContaining({
      sourceEventId: 'library-profile:8:stale_profile:2026-07-25T12:00:00.000Z:retry:91',
      availableAt: '2026-07-26T00:30:08.000Z',
    }));
  });

  test('does not enqueue a successor when terminal failure history is incomplete', async () => {
    const enqueue = jest.fn().mockResolvedValue({
      outbox: { id: '91', processingState: 'failed' },
      replayed: true,
      coalesced: false,
    });
    const planner = new PolicyNativeProfileRefreshPlanner({
      dbClient: { withTransaction: jest.fn(callback => callback({ query: jest.fn() })) },
      candidateRepository: {
        findCandidates: jest.fn().mockResolvedValue([{
          libraryId: 8,
          profileState: 'missing_profile',
          observedItemCount: 4,
          observedItemHighWaterMark: 8,
        }]),
      },
      enqueue,
      failureRepository: { findHistory: jest.fn().mockResolvedValue(null) },
      circuitRepository: createCircuitRepository(),
      loggerInstance: { info: jest.fn() },
    });

    await expect(planner.run()).resolves.toMatchObject({ successorInvalid: 1 });
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  test('does not enqueue a native successor for a known permanent configuration failure', async () => {
    const enqueue = jest.fn().mockResolvedValue({
      outbox: { id: '91', processingState: 'failed' },
      replayed: true,
      coalesced: false,
    });
    const planner = new PolicyNativeProfileRefreshPlanner({
      dbClient: { withTransaction: jest.fn(callback => callback({ query: jest.fn() })) },
      candidateRepository: {
        findCandidates: jest.fn().mockResolvedValue([{
          libraryId: 8,
          profileState: 'stale_profile',
          profileGeneratedAt: '2026-07-25T12:00:00.000Z',
        }]),
      },
      enqueue,
      failureRepository: {
        findHistory: jest.fn().mockResolvedValue({
          failedOutboxId: '91',
          failureCode: 'profile_refresh_configuration_invalid',
          failureCount: 1,
        }),
      },
      circuitRepository: createCircuitRepository({
        failureTransition: {
          ready: true,
          opened: true,
          circuit: createOpenCircuit(),
        },
      }),
      loggerInstance: { info: jest.fn() },
    });

    await expect(planner.run()).resolves.toMatchObject({
      replayed: 1,
      successorQueued: 0,
      successorBlocked: 1,
    });
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  test('blocks ordinary enqueue while a native refresh circuit is open', async () => {
    const circuitRepository = createCircuitRepository({
      circuit: createOpenCircuit({ nextProbeAt: '2026-07-28T14:00:00.000Z' }),
    });
    const enqueue = jest.fn();
    const planner = new PolicyNativeProfileRefreshPlanner({
      dbClient: { withTransaction: jest.fn(callback => callback({ query: jest.fn() })) },
      candidateRepository: {
        findCandidates: jest.fn().mockResolvedValue([{
          libraryId: 8,
          profileState: 'stale_profile',
          profileGeneratedAt: '2026-07-25T12:00:00.000Z',
        }]),
      },
      circuitRepository,
      enqueue,
      now: () => new Date('2026-07-28T13:00:00.000Z'),
      loggerInstance: { info: jest.fn() },
    });

    await expect(planner.run()).resolves.toMatchObject({
      circuitBlocked: 1,
      queued: 0,
    });
    expect(enqueue).not.toHaveBeenCalled();
    expect(circuitRepository.lock).toHaveBeenCalledWith(expect.objectContaining({
      libraryId: 8,
      sourceEventId: SOURCE_EVENT_ID,
    }));
  });

  test('reopens a half-open circuit when its active probe reaches terminal failure', async () => {
    const client = { query: jest.fn() };
    const circuitRepository = createCircuitRepository({
      circuit: createHalfOpenCircuit(),
      failureTransition: {
        ready: true,
        opened: true,
        circuit: createOpenCircuit({ nextProbeAt: '2026-07-28T14:00:00.000Z' }),
      },
    });
    const enqueue = jest.fn();
    const failureRepository = {
      findHistory: jest.fn().mockResolvedValue({
        failedOutboxId: '94',
        failureCode: 'profile_refresh_lease_expired',
        failureCount: 2,
      }),
    };
    const planner = new PolicyNativeProfileRefreshPlanner({
      dbClient: { withTransaction: jest.fn(callback => callback(client)) },
      candidateRepository: {
        findCandidates: jest.fn().mockResolvedValue([{
          libraryId: 8,
          profileState: 'stale_profile',
          profileGeneratedAt: '2026-07-25T12:00:00.000Z',
        }]),
      },
      circuitRepository,
      failureRepository,
      enqueue,
      now: () => new Date('2026-07-28T12:00:00.000Z'),
      loggerInstance: { info: jest.fn() },
    });

    await expect(planner.run()).resolves.toMatchObject({
      circuitOpened: 1,
      circuitBlocked: 1,
      queued: 0,
    });
    expect(circuitRepository.recordFailure).toHaveBeenCalledWith({
      client,
      libraryId: 8,
      sourceEventId: SOURCE_EVENT_ID,
      failedOutboxId: '94',
      failureCount: 2,
      failureCode: 'profile_refresh_lease_expired',
      now: new Date('2026-07-28T12:00:00.000Z'),
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  test('enqueues one successor-backed automatic probe when an open circuit is due', async () => {
    const client = { query: jest.fn() };
    const circuitRepository = createCircuitRepository({
      circuit: createOpenCircuit(),
    });
    const enqueue = jest.fn().mockResolvedValue({
      outbox: { id: '94', processingState: 'pending' },
      replayed: false,
      coalesced: false,
    });
    const planner = new PolicyNativeProfileRefreshPlanner({
      dbClient: { withTransaction: jest.fn(callback => callback(client)) },
      candidateRepository: {
        findCandidates: jest.fn().mockResolvedValue([{
          libraryId: 8,
          profileState: 'stale_profile',
          profileGeneratedAt: '2026-07-25T12:00:00.000Z',
        }]),
      },
      circuitRepository,
      failureRepository: {
        findHistory: jest.fn().mockResolvedValue({
          failedOutboxId: '93',
          failureCode: 'profile_refresh_unknown_failed',
          failureCount: 3,
        }),
      },
      enqueue,
      now: () => new Date('2026-07-28T14:00:00.000Z'),
      loggerInstance: { info: jest.fn() },
    });

    await expect(planner.run()).resolves.toMatchObject({
      circuitProbeQueued: 1,
      circuitBlocked: 0,
      queued: 0,
    });
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      client,
      record: expect.objectContaining({ sourceEventId: `${SOURCE_EVENT_ID}:retry:93` }),
    }));
    expect(circuitRepository.startProbe).toHaveBeenCalledWith({
      client,
      libraryId: 8,
      sourceEventId: SOURCE_EVENT_ID,
      probeOutboxId: '94',
      now: new Date('2026-07-28T14:00:00.000Z'),
    });
  });

  test('opens the circuit after the terminal threshold and skips an ordinary successor', async () => {
    const circuitRepository = createCircuitRepository({
      failureTransition: {
        ready: true,
        opened: true,
        circuit: createOpenCircuit(),
      },
    });
    const enqueue = jest.fn().mockResolvedValue({
      outbox: { id: '93', processingState: 'failed' },
      replayed: true,
      coalesced: false,
    });
    const planner = new PolicyNativeProfileRefreshPlanner({
      dbClient: { withTransaction: jest.fn(callback => callback({ query: jest.fn() })) },
      candidateRepository: {
        findCandidates: jest.fn().mockResolvedValue([{
          libraryId: 8,
          profileState: 'stale_profile',
          profileGeneratedAt: '2026-07-25T12:00:00.000Z',
        }]),
      },
      circuitRepository,
      failureRepository: {
        findHistory: jest.fn().mockResolvedValue({
          failedOutboxId: '93',
          failureCode: 'profile_refresh_unknown_failed',
          failureCount: 3,
        }),
      },
      enqueue,
      now: () => new Date('2026-07-28T12:00:00.000Z'),
      loggerInstance: { info: jest.fn() },
    });

    await expect(planner.run()).resolves.toMatchObject({
      circuitOpened: 1,
      successorBlocked: 1,
      successorQueued: 0,
    });
    expect(circuitRepository.recordFailure).toHaveBeenCalledWith(expect.objectContaining({
      failedOutboxId: '93',
      failureCount: 3,
      failureCode: 'profile_refresh_unknown_failed',
    }));
    expect(enqueue).toHaveBeenCalledTimes(1);
  });
});
