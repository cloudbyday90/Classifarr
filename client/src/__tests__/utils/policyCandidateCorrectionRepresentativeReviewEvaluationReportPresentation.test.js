/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it } from 'vitest'
import {
  normalizePolicyCandidateCorrectionRepresentativeReviewEvaluationReport,
  presentPolicyCandidateCorrectionRepresentativeReviewEvaluationSummary,
} from '@/utils/policyCandidateCorrectionRepresentativeReviewEvaluationReportPresentation'

const PERIOD_IDS = ['previous', 'current']
const MARGIN_BAND_IDS = ['0_to_4', '5_to_14', '15_to_29', '30_or_more']
const EVIDENCE_SOURCE_IDS = [
  'item_identity',
  'declared_policy',
  'observed_library_profile',
  'similar_item_retrieval',
  'confirmed_outcomes',
]
const EVIDENCE_STATE_IDS = ['anchored', 'supporting', 'contextual', 'conflicting', 'unavailable']

function summary(dimensions, itemCount = 0, confirmedCandidateCount = 0) {
  return {
    ...dimensions,
    itemCount,
    confirmedCandidateCount,
    confirmationRate: itemCount ? confirmedCandidateCount / itemCount : null,
    confirmationRateInterval95: itemCount ? { lowerBound: 0.1, upperBound: 0.9 } : null,
    selectionOutcomeCounts: [
      { selectionStatusId: 'confirmed_candidate', itemCount: confirmedCandidateCount },
      { selectionStatusId: 'changed_to_candidate', itemCount: itemCount - confirmedCandidateCount },
      { selectionStatusId: 'changed_outside_candidates', itemCount: 0 },
      { selectionStatusId: 'routed_not_applicable', itemCount: 0 },
    ],
  }
}

function response(overrides = {}) {
  const periodSummaries = [
    summary({ periodId: 'previous' }, 2, 1),
    summary({ periodId: 'current' }, 1, 1),
  ]
  const marginSummaries = PERIOD_IDS.flatMap(periodId => MARGIN_BAND_IDS.map(scoreMarginBandId => (
    summary(
      { periodId, scoreMarginBandId },
      periodId === 'previous' && scoreMarginBandId === '0_to_4'
        ? 2
        : periodId === 'current' && scoreMarginBandId === '5_to_14'
          ? 1
          : 0,
      periodId === 'previous' && scoreMarginBandId === '0_to_4'
        ? 1
        : periodId === 'current' && scoreMarginBandId === '5_to_14'
          ? 1
          : 0,
    )
  )))
  const evidenceStateSummaries = PERIOD_IDS.flatMap(periodId => EVIDENCE_SOURCE_IDS.flatMap(sourceId => (
    EVIDENCE_STATE_IDS.map(stateId => summary({ periodId, sourceId, stateId }))
  )))

  return {
    version: 'policy.candidate_correction_representative_review_evaluation_report.v1',
    statusId: 'report_available',
    historicalRecordAccess: false,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    purposeId: 'representative_historical_correction_review',
    report: {
      createdAt: '2026-08-30T12:00:00.000Z',
      expiresAt: '2026-09-29T12:00:00.000Z',
      itemCount: 3,
      windows: [
        { periodId: 'previous', startAt: '2026-07-01T00:00:00.000Z', endAt: '2026-07-29T00:00:00.000Z' },
        { periodId: 'current', startAt: '2026-07-29T00:00:00.000Z', endAt: '2026-08-26T00:00:00.000Z' },
      ],
      confidenceLevel: 0.95,
      periodSummaries,
      marginSummaries,
      evidenceStateSummaries,
      mediaTitle: 'must not render',
    },
    ...overrides,
  }
}

describe('representative review evaluation-report presentation', () => {
  it('retains only strict aggregate categories and rebuilds the uncertainty display', () => {
    const normalized = normalizePolicyCandidateCorrectionRepresentativeReviewEvaluationReport(response())

    expect(normalized).toEqual(expect.objectContaining({
      statusId: 'report_available',
      report: expect.objectContaining({ itemCount: 3 }),
    }))
    expect(JSON.stringify(normalized)).not.toContain('must not render')
    expect(JSON.stringify(normalized)).not.toContain('mediaTitle')
    expect(presentPolicyCandidateCorrectionRepresentativeReviewEvaluationSummary(
      normalized.report.marginSummaries[0],
    )).toEqual(expect.objectContaining({
      periodLabel: 'Previous 28 days',
      marginLabel: '0–4 points',
      confirmationRateLabel: '50%',
    }))
  })

  it('fails closed when the response grants automatic authority or changes a fixed evidence category', () => {
    expect(normalizePolicyCandidateCorrectionRepresentativeReviewEvaluationReport(response({
      automaticPolicyChange: true,
    }))).toBeNull()

    const invalidEvidence = response()
    invalidEvidence.report.evidenceStateSummaries[0].stateId = 'unknown'
    expect(normalizePolicyCandidateCorrectionRepresentativeReviewEvaluationReport(invalidEvidence)).toBeNull()
  })
})
