/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDataRequest = vi.fn()
const post = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest,
  apiClient: { post },
}))

const {
  getPolicyCandidateCorrectionPolicyChangeOutcomeObservation,
  startPolicyCandidateCorrectionPolicyChangeOutcomeObservation,
} = await import('../../api/policyChangeOutcomeObservationApi')

describe('policy-change outcome observation API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses fixed selector-free endpoints', () => {
    getPolicyCandidateCorrectionPolicyChangeOutcomeObservation()
    startPolicyCandidateCorrectionPolicyChangeOutcomeObservation()

    expect(getDataRequest).toHaveBeenCalledWith(
      '/policies/candidate-correction/policy-change-outcome-observation'
    )
    expect(post).toHaveBeenCalledWith(
      '/policies/candidate-correction/policy-change-outcome-observation',
      {}
    )
  })
})
