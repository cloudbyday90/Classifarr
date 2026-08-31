/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDataRequest = vi.fn()

vi.mock('../../api/core', () => ({ getDataRequest }))

const {
  getPolicyCandidateCorrectionPolicyChangeReviewHistorySummary,
} = await import('../../api/policyChangeReviewHistorySummaryApi')

describe('policy-change review history summary API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses one selector-free bounded summary endpoint', () => {
    getPolicyCandidateCorrectionPolicyChangeReviewHistorySummary()

    expect(getDataRequest).toHaveBeenCalledWith(
      '/policies/candidate-correction/policy-change-review-history-summary'
    )
  })
})
