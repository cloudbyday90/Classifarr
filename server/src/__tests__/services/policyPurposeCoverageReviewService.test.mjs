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
    const studySourceReadinessRecord = {
      active_policy_count: 2,
      profile_only_purpose_policy_count: 2,
      retained_purpose_policy_count: 0,
    };
    const loadStudySourceReadinessRecord = jest.fn().mockResolvedValue(studySourceReadinessRecord);
    const lifecycleReceiptRecords = [{ lifecycle_transition: 'native_intent_change' }];
    const loadLifecycleReceiptRecords = jest.fn().mockResolvedValue(lifecycleReceiptRecords);
    const buildReview = jest.fn().mockReturnValue({ rawConfigurationExposed: false });
    const service = new PolicyPurposeCoverageReviewService({
      db,
      now: () => '2026-08-16T12:00:00.000Z',
      loadRecords,
      loadStudySourceReadinessRecord,
      loadLifecycleReceiptRecords,
      lifecycleReceiptLimit: 2,
      buildReview,
    });

    await expect(service.getReview({ limit: 1 })).resolves.toEqual({ rawConfigurationExposed: false });
    expect(loadRecords).toHaveBeenCalledWith({ db, limit: 2 });
    expect(loadStudySourceReadinessRecord).toHaveBeenCalledWith({ db });
    expect(loadLifecycleReceiptRecords).toHaveBeenCalledWith({ db, limit: 3 });
    expect(buildReview).toHaveBeenCalledWith({
      records: [records[0]],
      studySourceReadinessRecord,
      lifecycleReceiptRecords,
      lifecycleReceiptLimit: 2,
      lifecycleReceiptTruncated: false,
      evaluatedAt: '2026-08-16T12:00:00.000Z',
      limit: 1,
      truncated: true,
    });
  });
});
