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
  findPolicyNativeProfileRefreshFailureHistory,
} from '../../services/policyNativeProfileRefreshFailureRepository.mjs';

describe('policyNativeProfileRefreshFailureRepository', () => {
  test('loads the newest terminal native-refresh failure and its bounded history count', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [{
        id: '91',
        failure_code: 'profile_refresh_execution_failed',
        failure_count: '2',
      }] }),
    };

    await expect(findPolicyNativeProfileRefreshFailureHistory({
      client,
      libraryId: 8,
      sourceEventId: 'library-profile:8:stale_profile:2026-07-25T12:00:00.000Z',
    })).resolves.toEqual({
      failedOutboxId: '91',
      failureCode: 'profile_refresh_execution_failed',
      failureCount: 2,
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('starts_with(source_event_id, $5 || \':retry:\')'),
      [
        8,
        'native_policy_profile_readiness',
        'native_readiness',
        'failed',
        'library-profile:8:stale_profile:2026-07-25T12:00:00.000Z',
      ],
    );
    expect(client.query.mock.calls[0][0]).toContain('failure_code');
  });

  test('does not turn a retry event or malformed identifier into a database query', async () => {
    const client = { query: jest.fn() };

    await expect(findPolicyNativeProfileRefreshFailureHistory({
      client,
      libraryId: 8,
      sourceEventId: 'library-profile:8:missing_profile:items:4:high-water:8:retry:91',
    })).resolves.toBeNull();
    await expect(findPolicyNativeProfileRefreshFailureHistory({
      client,
      libraryId: 0,
      sourceEventId: 'library-profile:8:missing_profile:items:4:high-water:8',
    })).resolves.toBeNull();

    expect(client.query).not.toHaveBeenCalled();
  });
});
