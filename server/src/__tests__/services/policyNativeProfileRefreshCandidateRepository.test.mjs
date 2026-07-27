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
  findPolicyNativeProfileRefreshCandidates,
} from '../../services/policyNativeProfileRefreshCandidateRepository.mjs';

describe('policyNativeProfileRefreshCandidateRepository', () => {
  test('scans only enabled active-native libraries with missing or stale stored profiles', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            library_id: '8',
            profile_state: 'missing_profile',
            profile_last_generated_at: null,
            observed_item_count: '12',
            observed_item_high_water_mark: '91',
          },
          {
            library_id: '9',
            profile_state: 'stale_profile',
            profile_last_generated_at: '2026-07-18T12:00:00.000Z',
            observed_item_count: '4',
            observed_item_high_water_mark: '95',
          },
          {
            library_id: 'not-an-id',
            profile_state: 'stale_profile',
            profile_last_generated_at: '2026-07-18T12:00:00.000Z',
            observed_item_count: '1',
            observed_item_high_water_mark: '96',
          },
        ],
      }),
    };

    await expect(findPolicyNativeProfileRefreshCandidates({ client, limit: 10 }))
      .resolves.toEqual([
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
          observedItemCount: 4,
          observedItemHighWaterMark: 95,
        },
      ]);

    expect(client.query.mock.calls[0][0]).toContain('intent.active = TRUE');
    expect(client.query.mock.calls[0][0]).toContain('ON observed_items.item_count > 0');
    expect(client.query.mock.calls[0][0]).toContain('COALESCE(policy.enabled, TRUE) = TRUE');
    expect(client.query.mock.calls[0][0]).toContain("INTERVAL '1 millisecond'");
    expect(client.query.mock.calls[0][1]).toEqual([604800000, 10]);
  });
});
