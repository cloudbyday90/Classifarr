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
  PolicyPurposeCoverageReviewService,
} from '../../services/policyPurposeCoverageReviewService.mjs';

describe('PolicyPurposeCoverageReviewService', () => {
  test('over-fetches one bounded row to report truncation without an unbounded query', async () => {
    const db = { query: jest.fn() };
    const records = [{ policy_id: 17 }, { policy_id: 18 }];
    const loadRecords = jest.fn().mockResolvedValue(records);
    const buildReview = jest.fn().mockReturnValue({ rawConfigurationExposed: false });
    const service = new PolicyPurposeCoverageReviewService({
      db,
      now: () => '2026-08-16T12:00:00.000Z',
      loadRecords,
      buildReview,
    });

    await expect(service.getReview({ limit: 1 })).resolves.toEqual({ rawConfigurationExposed: false });
    expect(loadRecords).toHaveBeenCalledWith({ db, limit: 2 });
    expect(buildReview).toHaveBeenCalledWith({
      records: [records[0]],
      evaluatedAt: '2026-08-16T12:00:00.000Z',
      limit: 1,
      truncated: true,
    });
  });
});
