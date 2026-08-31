/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  PolicyScopedEvidenceDigestService,
} from '../../services/policyScopedEvidenceDigestService.mjs';

describe('PolicyScopedEvidenceDigestService', () => {
  test('loads one fixed ninety-day selected-policy context before building a read-only digest', async () => {
    const db = { query: jest.fn() };
    const loadContext = jest.fn().mockResolvedValue({ policy: { id: 17, library_id: 8 } });
    const buildDigest = jest.fn().mockReturnValue({ statusId: 'available' });
    const now = new Date('2026-08-16T12:00:00.000Z');
    const service = new PolicyScopedEvidenceDigestService({ db, loadContext, buildDigest });

    await expect(service.getDigest({ policyId: 17, now })).resolves.toEqual({ statusId: 'available' });
    expect(loadContext).toHaveBeenCalledWith({
      db,
      policyId: 17,
      since: new Date('2026-05-18T12:00:00.000Z'),
    });
    expect(buildDigest).toHaveBeenCalledWith(expect.objectContaining({
      policy: { id: 17, library_id: 8 },
      evaluatedAt: now,
      historyWindowDays: 90,
    }));
  });

  test('returns a sanitized unavailable contract if persistence fails', async () => {
    const service = new PolicyScopedEvidenceDigestService({
      loadContext: jest.fn().mockRejectedValue(new Error('database detail')),
    });

    await expect(service.getDigest({
      dbClient: { query: jest.fn() },
      policyId: 17,
      now: new Date('2026-08-16T12:00:00.000Z'),
    })).resolves.toEqual(expect.objectContaining({
      statusId: 'unavailable',
      policyId: 17,
      scope: expect.objectContaining({ rawMediaExposed: false }),
    }));
  });
});
