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
  buildPolicyNativeProfileRefreshRequest,
} from '../../services/policyNativeProfileRefreshRequest.mjs';

describe('policyNativeProfileRefreshRequest', () => {
  test('creates a compact server-owned request for a stale stored profile', () => {
    const result = buildPolicyNativeProfileRefreshRequest({
      libraryId: '8',
      profileState: 'stale_profile',
      profileGeneratedAt: '2026-07-18T12:00:00.000Z',
    });

    expect(result).toMatchObject({
      statusId: 'ready',
      record: {
        sourceId: 'native_policy_profile_readiness',
        sourceEventId: 'library-profile:8:stale_profile:2026-07-18T12:00:00.000Z',
        libraryId: 8,
        classificationId: null,
        learningOperationId: null,
        candidateKey: null,
        refreshReasonId: 'stale_library_profile',
        requestType: 'native_readiness',
        sourceSystem: 'policy_native_readiness_profile_refresh',
      },
    });
  });

  test('creates a stable missing-profile request without borrowing a policy or learning identity', () => {
    const result = buildPolicyNativeProfileRefreshRequest({
      libraryId: 8,
      profileState: 'missing_profile',
      observedItemCount: 12,
      observedItemHighWaterMark: 91,
    });

    expect(result).toMatchObject({
      statusId: 'ready',
      record: {
        sourceEventId: 'library-profile:8:missing_profile:items:12:high-water:91',
        classificationId: null,
        learningTierId: null,
      },
    });
  });

  test('rejects a stale profile without a usable server timestamp', () => {
    expect(buildPolicyNativeProfileRefreshRequest({
      libraryId: 8,
      profileState: 'stale_profile',
      profileGeneratedAt: 'not-a-timestamp',
    })).toMatchObject({
      statusId: 'invalid',
      ready: false,
      reasonCodes: ['stale_native_profile_without_timestamp'],
    });
  });

  test('rejects a missing profile without a bounded observed-content revision', () => {
    expect(buildPolicyNativeProfileRefreshRequest({
      libraryId: 8,
      profileState: 'missing_profile',
    })).toMatchObject({
      statusId: 'invalid',
      ready: false,
      reasonCodes: ['missing_native_profile_without_observed_content_revision'],
    });
  });
});
