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
  PolicyCandidateCorrectionRepresentativeReviewProjectionRetentionService,
} from '../../services/policyCandidateCorrectionRepresentativeReviewProjectionRetentionService.mjs';

const SNAPSHOT_ID = 'a'.repeat(64);

function createHarness({ acquired = true } = {}) {
  const persistence = {
    tryLock: jest.fn().mockResolvedValue(acquired),
    lockExpired: jest.fn().mockResolvedValue([{
      snapshot_id: SNAPSHOT_ID,
      configuration_revision: 'b'.repeat(64),
      item_count: 3,
      created_at: '2026-07-01T00:00:00.000Z',
    }]),
    deleteProjection: jest.fn().mockResolvedValue({ snapshot_id: SNAPSHOT_ID }),
    insertAuditEvent: jest.fn().mockResolvedValue({ id: 1 }),
  };
  const db = { withTransaction: jest.fn(async callback => callback({ query: jest.fn() })) };
  return {
    persistence,
    service: new PolicyCandidateCorrectionRepresentativeReviewProjectionRetentionService({
      db,
      logger: { info: jest.fn(), error: jest.fn() },
      persistence,
    }),
  };
}

describe('representative review projection retention service', () => {
  test('deletes expired snapshots and writes a minimal expiry audit event atomically', async () => {
    const { service, persistence } = createHarness();

    await expect(service.cleanup({ now: '2026-08-30T12:00:00.000Z' })).resolves.toEqual(expect.objectContaining({
      statusId: 'completed',
      deletedProjectionCount: 1,
    }));
    expect(persistence.deleteProjection).toHaveBeenCalledWith(expect.objectContaining({ snapshotId: SNAPSHOT_ID }));
    expect(persistence.insertAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ actionId: 'projection_expired', actorId: null, itemCount: 3 }),
    }));
  });

  test('does not select or delete rows when another cleanup holds the lock', async () => {
    const { service, persistence } = createHarness({ acquired: false });

    await expect(service.cleanup()).resolves.toEqual(expect.objectContaining({
      statusId: 'cleanup_locked',
      deletedProjectionCount: 0,
    }));
    expect(persistence.lockExpired).not.toHaveBeenCalled();
    expect(persistence.deleteProjection).not.toHaveBeenCalled();
  });
});
