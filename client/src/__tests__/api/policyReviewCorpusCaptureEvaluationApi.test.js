/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDataRequest = vi.fn()

vi.mock('../../api/core', () => ({ getDataRequest }))

const {
  getPolicyCandidateCorrectionReviewCorpusCaptureEvaluation,
} = await import('../../api/policyReviewCorpusCaptureEvaluationApi')

describe('policy review-corpus capture evaluation API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses one fixed aggregate-only GET endpoint with no caller-selected filters', () => {
    getPolicyCandidateCorrectionReviewCorpusCaptureEvaluation()
    expect(getDataRequest).toHaveBeenCalledWith(
      '/policies/candidate-correction/review-corpus/captured-outcomes/evaluation'
    )
  })
})
