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
  compactPolicyNativeProfileRefreshCircuitHistory,
} from '../../services/policyNativeProfileRefreshCircuitCompactionRepository.mjs';

describe('policyNativeProfileRefreshCircuitCompactionRepository', () => {
  test('compacts only retained native history outside current source revisions', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [{
        circuits_compacted: '2',
        outbox_rows_compacted: '5',
      }] }),
    };

    await expect(compactPolicyNativeProfileRefreshCircuitHistory({
      client,
      protectedRevisions: [{
        libraryId: 8,
        sourceEventId: 'library-profile:8:stale_profile:2026-07-25T12:00:00.000Z',
      }],
    })).resolves.toEqual({ circuitsCompacted: 2, outboxRowsCompacted: 5 });

    expect(client.query.mock.calls[0][0]).toContain('split_part(outbox.source_event_id, \':retry:\', 1)');
    expect(client.query.mock.calls[0][0]).toContain('protected_revisions');
    expect(client.query.mock.calls[0][1]).toEqual([
      [8],
      ['library-profile:8:stale_profile:2026-07-25T12:00:00.000Z'],
      30,
      'native_readiness',
      ['completed', 'failed'],
    ]);
  });
});
