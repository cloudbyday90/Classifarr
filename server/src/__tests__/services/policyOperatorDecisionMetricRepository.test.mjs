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
  POLICY_OPERATOR_DECISION_METRIC_QUERY,
  collectPolicyOperatorDecisionMetric,
} from '../../services/policyOperatorDecisionMetricRepository.mjs';

const WINDOW_STARTED_AT = '2026-08-01T00:00:00.000Z';
const WINDOW_ENDED_AT = '2026-08-02T00:00:00.000Z';

describe('policy operator-decision metric repository', () => {
  test('collects bounded aggregate counts without selecting classification data', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        classifiedOutcomeCount: '9',
        openOperatorReviewCount: '2',
        pendingRetryCount: '1',
        automaticallyRoutedCount: '4',
        policyAutomaticOutcomeCount: '6',
      }],
    });

    const metric = await collectPolicyOperatorDecisionMetric({
      db: { query },
      measurementScopeId: 'all_classification_history',
      windowStartedAt: WINDOW_STARTED_AT,
      windowEndedAt: WINDOW_ENDED_AT,
      generatedAt: '2026-08-03T00:00:00.000Z',
    });

    expect(query).toHaveBeenCalledWith(POLICY_OPERATOR_DECISION_METRIC_QUERY, [
      WINDOW_STARTED_AT,
      WINDOW_ENDED_AT,
    ]);
    expect(metric).toEqual(expect.objectContaining({
      counts: {
        classifiedOutcomeCount: 9,
        openOperatorReviewCount: 2,
        pendingRetryCount: 1,
        automaticallyRoutedCount: 4,
        policyAutomaticOutcomeCount: 6,
      },
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(POLICY_OPERATOR_DECISION_METRIC_QUERY).not.toContain('title');
    expect(POLICY_OPERATOR_DECISION_METRIC_QUERY).not.toContain('library_name');
    expect(POLICY_OPERATOR_DECISION_METRIC_QUERY).not.toContain('metadata');
  });
});
