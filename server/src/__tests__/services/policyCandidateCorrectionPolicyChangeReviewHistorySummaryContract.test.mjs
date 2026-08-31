/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryReadModel,
  getPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationCompletedPeriods,
  getPolicyCandidateCorrectionPolicyChangeReviewHistoryCompletedPeriods,
  getPolicyCandidateCorrectionPolicyChangeReviewHistoryPeriodStart,
  getPolicyCandidateCorrectionPolicyChangeReviewHistoryRetentionCutoff,
} from '../../services/policyCandidateCorrectionPolicyChangeReviewHistorySummaryContract.mjs';

describe('policy-change review history summary contract', () => {
  test('uses fixed server-owned UTC periods and retains only seven bounded buckets', () => {
    const periodStart = getPolicyCandidateCorrectionPolicyChangeReviewHistoryPeriodStart('2026-08-31T12:00:00.000Z');
    const laterPeriodStart = getPolicyCandidateCorrectionPolicyChangeReviewHistoryPeriodStart('2026-09-01T12:00:00.000Z');

    expect(periodStart).toMatch(/^2026-\d{2}-\d{2}$/u);
    expect(laterPeriodStart).toMatch(/^2026-\d{2}-\d{2}$/u);
    expect(getPolicyCandidateCorrectionPolicyChangeReviewHistoryRetentionCutoff('2026-08-31T12:00:00.000Z'))
      .toMatch(/^2026-\d{2}-\d{2}$/u);
    expect(getPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationCompletedPeriods({
      startedAt: '2026-01-01T00:00:00.000Z',
      now: '2026-08-31T12:00:00.000Z',
    })).toHaveLength(6);
  });

  test('withholds incomplete collection periods and returns only fixed aggregate dimensions', () => {
    const now = '2026-08-31T12:00:00.000Z';
    expect(getPolicyCandidateCorrectionPolicyChangeReviewHistoryCompletedPeriods({
      startedAt: now,
      now,
    })).toEqual([]);

    const periods = getPolicyCandidateCorrectionPolicyChangeReviewHistoryCompletedPeriods({
      startedAt: '2026-01-01T00:00:00.000Z',
      now,
    });
    const model = buildPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryReadModel({
      control: { started_at: '2026-01-01T00:00:00.000Z' },
      aggregateRows: [{
        period_start: periods[0].periodStart,
        decision_id: 'retain_current_policy',
        recorded_count: 2,
        revised_count: 1,
        actor_id: 7,
        policy_id: 8,
      }],
      now,
    });

    expect(model).toEqual(expect.objectContaining({
      version: 'policy.candidate_correction_policy_change_review_history_summary.v3',
      statusId: 'available',
      historyAvailable: true,
      consistency: expect.objectContaining({
        statusId: 'insufficient_activity',
        comparisonAvailable: false,
      }),
      calibrationReadiness: expect.objectContaining({
        statusId: 'insufficient_activity',
        reviewEligible: false,
      }),
    }));
    expect(model.periods).toHaveLength(3);
    expect(model.periods[0].conclusionSummaries[0]).toEqual({
      decisionId: 'retain_current_policy',
      recordedCount: 2,
      revisedCount: 1,
      totalCount: 3,
    });
    expect(JSON.stringify(model)).not.toContain('periodStart');
    expect(JSON.stringify(model)).not.toContain('actor');
    expect(JSON.stringify(model)).not.toContain('policyId');
    expect(JSON.stringify(model)).not.toContain('calibrationPeriods');
  });
});
