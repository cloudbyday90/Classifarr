/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyCandidateContrastiveOutcomeMetricsReport,
  buildPolicyCandidateContrastiveOutcomeMetricsWindow,
  normalizePolicyCandidateContrastiveOutcomeMetricsWindowDays,
} from '../../services/policyCandidateContrastiveOutcomeMetrics.mjs';

describe('policyCandidateContrastiveOutcomeMetrics', () => {
  test('uses the bounded completed UTC-day window', () => {
    expect(normalizePolicyCandidateContrastiveOutcomeMetricsWindowDays(0)).toBe(7);
    expect(normalizePolicyCandidateContrastiveOutcomeMetricsWindowDays(100)).toBe(30);

    expect(buildPolicyCandidateContrastiveOutcomeMetricsWindow({
      windowDays: 14,
      now: new Date('2026-08-30T18:30:00.000Z'),
    })).toEqual(expect.objectContaining({
      days: 14,
      start: new Date('2026-08-16T00:00:00.000Z'),
      end: new Date('2026-08-30T00:00:00.000Z'),
    }));
  });

  test('reports fixed contrastive buckets and clamps malformed aggregate counts', () => {
    const report = buildPolicyCandidateContrastiveOutcomeMetricsReport({
      window: buildPolicyCandidateContrastiveOutcomeMetricsWindow({
        windowDays: 7,
        now: new Date('2026-08-30T18:30:00.000Z'),
      }),
      rows: [
        {
          contrastiveStatusId: 'alternative_identity_match',
          observationCount: 10,
          resolvedOutcomeCount: 8,
          attributedOutcomeCount: 6,
          confirmedCandidateOutcomeCount: 1,
          changedToCandidateOutcomeCount: 3,
          changedOutsideCandidateOutcomeCount: 2,
          routedNotApplicableOutcomeCount: 99,
        },
        {
          contrastiveStatusId: 'provider_supplied_status',
          observationCount: 999,
        },
      ],
    });

    const alternativeBucket = report.buckets.find((bucket) => (
      bucket.statusId === 'alternative_identity_match'
    ));
    expect(report).toMatchObject({
      version: 'policy.candidate_contrastive_outcome_metrics.v1',
      summary: {
        observationCount: 10,
        attributedOutcomeCount: 6,
        applicableDecisionCount: 6,
        changedSelectionOutcomeCount: 5,
        changedSelectionRatePercent: 83.3,
      },
      readiness: { statusId: 'observing' },
    });
    expect(alternativeBucket).toEqual(expect.objectContaining({
      observationCount: 10,
      resolvedOutcomeCount: 8,
      attributedOutcomeCount: 6,
      confirmedCandidateOutcomeCount: 1,
      changedToCandidateOutcomeCount: 3,
      changedOutsideCandidateOutcomeCount: 2,
      routedNotApplicableOutcomeCount: 0,
      unattributedResolvedOutcomeCount: 2,
      changedSelectionRatePercent: 83.3,
      outsideCandidateRatePercent: 33.3,
    }));
    expect(report.buckets).toHaveLength(6);
    expect(JSON.stringify(report)).not.toContain('provider_supplied_status');
    expect(JSON.stringify(report)).not.toContain('library_id');
    expect(JSON.stringify(report)).not.toContain('title');
  });
});
