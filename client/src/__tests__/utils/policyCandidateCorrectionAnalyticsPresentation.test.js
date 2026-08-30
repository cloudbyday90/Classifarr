/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  normalizePolicyCandidateCorrectionAnalyticsMetricsReport,
} from '@/utils/policyCandidateCorrectionAnalyticsPresentation'

function report(overrides = {}) {
  return {
    version: 'policy.candidate_correction_analytics_metrics.v1',
    window: { days: 7, startDate: '2026-08-23', endDate: '2026-08-30' },
    marginBuckets: [
      {
        marginBandId: '5_to_14',
        outcomeCount: 10,
        confirmedLeaderOutcomeCount: 4,
        changedToCandidateOutcomeCount: 3,
        changedOutsideCandidatesOutcomeCount: 2,
        routedNotApplicableOutcomeCount: 1,
      },
    ],
    evidenceSourceStateBuckets: [
      {
        evidenceSourceId: 'declared_policy',
        evidenceStateId: 'supporting',
        outcomeCount: 10,
        confirmedLeaderOutcomeCount: 4,
        changedToCandidateOutcomeCount: 3,
        changedOutsideCandidatesOutcomeCount: 2,
        routedNotApplicableOutcomeCount: 1,
      },
    ],
    summary: {
      outcomeCount: 10,
      confirmedLeaderOutcomeCount: 4,
      changedToCandidateOutcomeCount: 3,
      changedOutsideCandidatesOutcomeCount: 2,
      routedNotApplicableOutcomeCount: 1,
    },
    ...overrides,
  }
}

describe('policyCandidateCorrectionAnalyticsPresentation', () => {
  it('keeps only fixed aggregate dimensions and local labels', () => {
    const normalized = normalizePolicyCandidateCorrectionAnalyticsMetricsReport(report({
      rawCatalogTitle: 'Do not display',
      evidenceSourceStateBuckets: [
        ...report().evidenceSourceStateBuckets,
        {
          evidenceSourceId: 'provider_evidence',
          evidenceStateId: 'verdict',
          outcomeCount: 999,
        },
      ],
    }))

    expect(normalized).toMatchObject({
      summary: { outcomeCount: 10, changedSelectionRatePercent: 55.6 },
      readiness: { statusId: 'observing' },
    })
    expect(normalized.marginBuckets).toHaveLength(4)
    expect(normalized.evidenceSourceStateBuckets).toEqual([
      expect.objectContaining({
        sourceLabel: 'Declared policy',
        stateLabel: 'Supporting',
      }),
    ])
    expect(JSON.stringify(normalized)).not.toContain('Do not display')
    expect(JSON.stringify(normalized)).not.toContain('provider_evidence')
  })

  it('fails closed when the server summary does not match the bounded margin buckets', () => {
    const invalid = report()
    invalid.summary.outcomeCount = 2

    expect(normalizePolicyCandidateCorrectionAnalyticsMetricsReport(invalid)).toBeNull()
  })
})
