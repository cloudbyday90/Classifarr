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
  PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureRetentionService,
} from '../../services/policyCandidateCorrectionRepresentativeReviewCorpusCaptureRetentionService.mjs';

const CAPTURE_ID = 'a'.repeat(64);

function createHarness({ acquired = true } = {}) {
  const persistence = {
    tryLock: jest.fn().mockResolvedValue(acquired),
    lockExpired: jest.fn().mockResolvedValue([{
      capture_id: CAPTURE_ID,
      configuration_revision: 'b'.repeat(64),
      captured_at: '2026-07-01T00:00:00.000Z',
    }]),
    deleteCapture: jest.fn().mockResolvedValue({ capture_id: CAPTURE_ID }),
    insertAuditEvent: jest.fn().mockResolvedValue({ id: 1 }),
  };
  const db = { withTransaction: jest.fn(async callback => callback({ query: jest.fn() })) };
  return {
    persistence,
    service: new PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureRetentionService({
      db,
      logger: { info: jest.fn(), error: jest.fn() },
      persistence,
    }),
  };
}

describe('representative review-corpus capture retention service', () => {
  test('deletes expired redacted captures and writes an atomic expiry audit event', async () => {
    const { service, persistence } = createHarness();

    await expect(service.cleanup({ now: '2026-09-01T12:00:00.000Z' })).resolves.toEqual(expect.objectContaining({
      statusId: 'completed',
      deletedCaptureCount: 1,
    }));
    expect(persistence.deleteCapture).toHaveBeenCalledWith({
      client: expect.any(Object),
      captureId: CAPTURE_ID,
    });
    expect(persistence.insertAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ actionId: 'capture_expired', actorId: null }),
    }));
  });

  test('does not select or delete captures when another cleanup holds the lock', async () => {
    const { service, persistence } = createHarness({ acquired: false });

    await expect(service.cleanup()).resolves.toEqual(expect.objectContaining({
      statusId: 'cleanup_locked',
      deletedCaptureCount: 0,
    }));
    expect(persistence.lockExpired).not.toHaveBeenCalled();
    expect(persistence.deleteCapture).not.toHaveBeenCalled();
  });
});
