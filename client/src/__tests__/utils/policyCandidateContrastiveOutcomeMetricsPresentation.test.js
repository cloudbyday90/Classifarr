/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  normalizePolicyCandidateContrastiveOutcomeMetricsReport,
} from '@/utils/policyCandidateContrastiveOutcomeMetricsPresentation'

describe('policyCandidateContrastiveOutcomeMetricsPresentation', () => {
  it('retains only fixed aggregate metric data and client-owned copy', () => {
    const report = normalizePolicyCandidateContrastiveOutcomeMetricsReport({
      version: 'policy.candidate_contrastive_outcome_metrics.v1',
      window: { days: 7, startDate: '2026-08-23', endDate: '2026-08-30' },
      buckets: [
        {
          statusId: 'alternative_identity_match',
          observationCount: 10,
          resolvedOutcomeCount: 8,
          attributedOutcomeCount: 6,
          confirmedCandidateOutcomeCount: 1,
          changedToCandidateOutcomeCount: 3,
          changedOutsideCandidateOutcomeCount: 2,
          routedNotApplicableOutcomeCount: 0,
          changedSelectionRatePercent: 83.3,
          destinationLibraryId: 8,
          catalogTitle: 'Private catalog title',
        },
      ],
      readiness: { statusId: 'provider_supplied_status', message: 'Private server copy' },
    })

    expect(report).toMatchObject({
      summary: {
        observationCount: 10,
        attributedOutcomeCount: 6,
        applicableDecisionCount: 6,
        changedSelectionOutcomeCount: 5,
        changedSelectionRatePercent: 83.3,
      },
      readiness: { statusId: 'observing' },
      buckets: [
        expect.objectContaining({
          statusId: 'alternative_identity_match',
          label: 'Alternative only',
          changedOutsideCandidateOutcomeCount: 2,
        }),
      ],
    })
    expect(JSON.stringify(report)).not.toContain('Private catalog title')
    expect(JSON.stringify(report)).not.toContain('provider_supplied_status')
    expect(JSON.stringify(report)).not.toContain('destinationLibraryId')
  })

  it('fails closed for an unsupported report version or bucket', () => {
    expect(normalizePolicyCandidateContrastiveOutcomeMetricsReport({ version: 'unknown' })).toBeNull()
    expect(normalizePolicyCandidateContrastiveOutcomeMetricsReport({
      version: 'policy.candidate_contrastive_outcome_metrics.v1',
      buckets: [{ statusId: 'provider_supplied_status', observationCount: 99 }],
    })).toMatchObject({
      buckets: [],
      readiness: { statusId: 'insufficient_data' },
    })
  })
})
