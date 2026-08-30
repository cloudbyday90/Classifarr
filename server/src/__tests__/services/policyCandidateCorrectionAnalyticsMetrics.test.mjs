/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyCandidateCorrectionAnalyticsMetricsReport,
  buildPolicyCandidateCorrectionAnalyticsMetricsWindow,
  normalizePolicyCandidateCorrectionAnalyticsMetricsWindowDays,
} from '../../services/policyCandidateCorrectionAnalyticsMetrics.mjs';

describe('policyCandidateCorrectionAnalyticsMetrics', () => {
  test('uses the bounded completed UTC-day window', () => {
    expect(normalizePolicyCandidateCorrectionAnalyticsMetricsWindowDays(0)).toBe(7);
    expect(normalizePolicyCandidateCorrectionAnalyticsMetricsWindowDays(100)).toBe(30);

    expect(buildPolicyCandidateCorrectionAnalyticsMetricsWindow({
      windowDays: 14,
      now: new Date('2026-08-30T18:30:00.000Z'),
    })).toEqual(expect.objectContaining({
      days: 14,
      start: new Date('2026-08-16T00:00:00.000Z'),
      end: new Date('2026-08-30T00:00:00.000Z'),
    }));
  });

  test('reports fixed margin and source-state buckets while dropping unknown dimensions', () => {
    const report = buildPolicyCandidateCorrectionAnalyticsMetricsReport({
      window: buildPolicyCandidateCorrectionAnalyticsMetricsWindow({
        windowDays: 7,
        now: new Date('2026-08-30T18:30:00.000Z'),
      }),
      rows: [
        {
          rowKind: 'margin_band',
          scoreMarginBandId: '5_to_14',
          outcomeCount: 20,
          confirmedLeaderOutcomeCount: 10,
          changedToCandidateOutcomeCount: 6,
          changedOutsideCandidatesOutcomeCount: 4,
        },
        {
          rowKind: 'evidence_source_state',
          evidenceSourceId: 'declared_policy',
          evidenceStateId: 'supporting',
          outcomeCount: 20,
          confirmedLeaderOutcomeCount: 10,
          changedToCandidateOutcomeCount: 6,
          changedOutsideCandidatesOutcomeCount: 4,
        },
        {
          rowKind: 'evidence_source_state',
          evidenceSourceId: 'similar_item_retrieval',
          evidenceStateId: 'unavailable',
          outcomeCount: 5,
          confirmedLeaderOutcomeCount: 1,
          changedToCandidateOutcomeCount: 2,
          changedOutsideCandidatesOutcomeCount: 2,
        },
        {
          rowKind: 'margin_band',
          scoreMarginBandId: 'provider-defined-band',
          outcomeCount: 999,
        },
      ],
    });

    const closeBucket = report.marginBuckets.find((bucket) => bucket.marginBandId === '5_to_14');
    expect(report).toMatchObject({
      version: 'policy.candidate_correction_analytics_metrics.v2',
      summary: {
        outcomeCount: 20,
        confirmedLeaderOutcomeCount: 10,
        changedToCandidateOutcomeCount: 6,
        changedOutsideCandidatesOutcomeCount: 4,
        changedSelectionOutcomeCount: 10,
        changedSelectionRatePercent: 50,
      },
      readiness: { statusId: 'observing' },
      calibrationReadiness: {
        statusId: 'review_recommended',
        applicableDecisionCount: 20,
        changedSelectionOutcomeCount: 10,
      },
    });
    expect(closeBucket).toEqual(expect.objectContaining({
      outcomeCount: 20,
      applicableDecisionCount: 20,
      changedSelectionRatePercent: 50,
      calibrationReadiness: expect.objectContaining({ statusId: 'review_recommended' }),
    }));
    expect(report.marginBuckets).toHaveLength(4);
    expect(report.evidenceSourceStateBuckets).toHaveLength(2);
    expect(JSON.stringify(report)).not.toContain('provider-defined-band');
    expect(JSON.stringify(report)).not.toContain('library_id');
    expect(JSON.stringify(report)).not.toContain('title');
  });
});
