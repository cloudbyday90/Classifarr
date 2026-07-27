/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildPolicyNativeProfileRefreshSuccessor,
  buildSuccessorSourceEventId,
  calculateNativeProfileRefreshSuccessorDelayMs,
} from '../../services/policyNativeProfileRefreshSuccessor.mjs';

function nativeRecord(overrides = {}) {
  return {
    sourceId: 'native_policy_profile_readiness',
    sourceEventId: 'library-profile:8:stale_profile:2026-07-25T12:00:00.000Z',
    libraryId: 8,
    refreshReasonId: 'stale_library_profile',
    requestType: 'native_readiness',
    sourceSystem: 'policy_native_readiness_profile_refresh',
    ...overrides,
  };
}

describe('policyNativeProfileRefreshSuccessor', () => {
  test('uses capped exponential delay and deterministic second-granularity jitter', () => {
    expect(calculateNativeProfileRefreshSuccessorDelayMs({
      failureCount: 1,
      libraryId: 8,
      initialDelayMs: 1_000,
      maximumDelayMs: 8_000,
      jitterWindowMs: 0,
    })).toBe(1_000);
    expect(calculateNativeProfileRefreshSuccessorDelayMs({
      failureCount: 2,
      libraryId: 8,
      initialDelayMs: 1_000,
      maximumDelayMs: 8_000,
      jitterWindowMs: 0,
    })).toBe(2_000);
    expect(calculateNativeProfileRefreshSuccessorDelayMs({
      failureCount: 10,
      libraryId: 8,
      initialDelayMs: 1_000,
      maximumDelayMs: 8_000,
      jitterWindowMs: 0,
    })).toBe(8_000);
    expect(calculateNativeProfileRefreshSuccessorDelayMs({
      failureCount: 1,
      libraryId: 8,
      initialDelayMs: 1_000,
      maximumDelayMs: 30_000,
      jitterWindowMs: 60_000,
    })).toBe(9_000);
  });

  test('builds an idempotent delayed successor from a terminal outbox record', () => {
    expect(buildPolicyNativeProfileRefreshSuccessor({
      record: nativeRecord(),
      failedOutboxId: '91',
      failureCount: 2,
      now: '2026-07-26T00:00:00.000Z',
    })).toEqual(expect.objectContaining({
      statusId: 'ready',
      ready: true,
      reasonCodes: ['terminal_native_profile_refresh_recovery'],
      record: expect.objectContaining({
        sourceEventId: 'library-profile:8:stale_profile:2026-07-25T12:00:00.000Z:retry:91',
        availableAt: '2026-07-26T00:30:08.000Z',
      }),
    }));
  });

  test('rejects malformed or chained source-event retries', () => {
    expect(buildSuccessorSourceEventId({
      sourceEventId: 'library-profile:8:missing_profile:items:4:high-water:8:retry:91',
      failedOutboxId: 92,
    })).toBeNull();
    expect(buildPolicyNativeProfileRefreshSuccessor({
      record: nativeRecord({ sourceId: 'manual_refresh' }),
      failedOutboxId: 91,
      failureCount: 1,
    })).toEqual(expect.objectContaining({ statusId: 'invalid', ready: false, record: null }));
  });
});
