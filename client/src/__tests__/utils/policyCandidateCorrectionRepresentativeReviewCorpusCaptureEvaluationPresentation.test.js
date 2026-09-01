/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  getPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationPresentation,
  normalizePolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluation,
} from '@/utils/policyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationPresentation'

function evaluation(overrides = {}) {
  return {
    version: 'policy.candidate_correction_representative_review_corpus_capture_evaluation.v1',
    statusId: 'collecting',
    purposeId: 'representative_historical_correction_review',
    automaticFutureCapture: true,
    authority: {
      scope: 'offline_evaluation_only',
      historicalRecordAccess: false,
      retainedItemAccess: false,
      automaticActions: {
        aiInvocation: false,
        learning: false,
        policyChange: false,
        ragTuning: false,
        retry: false,
        routing: false,
      },
    },
    report: {
      capturedOutcomeCount: 1,
      minimumCapturedOutcomeCount: 24,
      scoreMarginCoverage: [
        '0_to_4', '5_to_14', '15_to_29', '30_or_more',
      ].map((scoreMarginBandId, index) => ({
        scoreMarginBandId,
        capturedOutcomeCount: index === 0 ? 1 : 0,
        minimumCapturedOutcomeCount: 6,
        minimumSatisfied: false,
        confirmedCandidateCount: index === 0 ? 1 : 0,
        changedSelectionCount: 0,
        confirmedCandidateRate: index === 0 ? 1 : null,
        selectionOutcomeCounts: [
          { selectionStatusId: 'confirmed_candidate', captureCount: index === 0 ? 1 : 0 },
          { selectionStatusId: 'changed_to_candidate', captureCount: 0 },
          { selectionStatusId: 'changed_outside_candidates', captureCount: 0 },
          { selectionStatusId: 'routed_not_applicable', captureCount: 0 },
        ],
      })),
    },
    ...overrides,
  }
}

describe('policyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationPresentation', () => {
  it('keeps only compact fixed aggregate coverage before display', () => {
    const normalized = normalizePolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluation(
      evaluation({ mediaTitle: 'Do not display', report: { ...evaluation().report, prompt: 'Do not display' } })
    )

    expect(normalized).toEqual(expect.objectContaining({
      statusId: 'collecting',
      report: expect.objectContaining({ capturedOutcomeCount: 1 }),
    }))
    expect(JSON.stringify(normalized)).not.toContain('Do not display')
    expect(getPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationPresentation(normalized))
      .toMatchObject({ heading: 'Collecting redacted operator outcomes automatically' })
  })

  it('fails closed when the aggregate contract grants a prohibited authority', () => {
    const invalid = evaluation()
    invalid.authority.automaticActions.routing = true
    expect(normalizePolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluation(invalid)).toBeNull()
  })
})
