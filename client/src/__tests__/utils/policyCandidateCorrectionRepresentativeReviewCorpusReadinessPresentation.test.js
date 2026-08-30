/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  getPolicyCandidateCorrectionRepresentativeReviewCorpusPresentation,
  normalizePolicyCandidateCorrectionRepresentativeReviewCorpusReadiness,
} from '@/utils/policyCandidateCorrectionRepresentativeReviewCorpusReadinessPresentation'

function readiness(overrides = {}) {
  return {
    version: 'policy.candidate_correction_representative_review_corpus.v1',
    statusId: 'historical_corpus_design_required',
    historicalRecordAccess: false,
    reviewFrame: {
      periodCount: 2,
      completedUtcDaysPerPeriod: 28,
      strata: ['score_margin_band', 'operator_selection_outcome'],
    },
    requiredSafeguardIds: ['authorization', 'redaction', 'retention', 'operator_audit'],
    ...overrides,
  }
}

describe('policyCandidateCorrectionRepresentativeReviewCorpusReadinessPresentation', () => {
  it('keeps only the fixed, content-free preflight state and local safeguard copy', () => {
    const normalized = normalizePolicyCandidateCorrectionRepresentativeReviewCorpusReadiness(
      readiness({ historicalTitles: ['Do not display'] }),
      { statusId: 'sustained_review_signal' },
    )

    expect(normalized).toEqual({
      statusId: 'historical_corpus_design_required',
      historicalRecordAccess: false,
    })
    expect(JSON.stringify(normalized)).not.toContain('Do not display')
    const presentation = getPolicyCandidateCorrectionRepresentativeReviewCorpusPresentation(
      normalized.statusId,
    )
    expect(presentation).toMatchObject({ heading: 'Historical review corpus is not enabled' })
    expect(presentation.safeguards).toContainEqual(expect.objectContaining({ id: 'authorization' }))
  })

  it('fails closed when the contract could expose records or disagree with the trend state', () => {
    expect(normalizePolicyCandidateCorrectionRepresentativeReviewCorpusReadiness(
      readiness({ historicalRecordAccess: true }),
      { statusId: 'sustained_review_signal' },
    )).toBeNull()

    expect(normalizePolicyCandidateCorrectionRepresentativeReviewCorpusReadiness(
      readiness(),
      { statusId: 'mixed_signal' },
    )).toBeNull()
  })
})
