/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  getPolicyCandidateCorrectionPolicyChangeReviewHistoryConsistencyPresentation,
  normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryConsistency,
} from '@/utils/policyCandidateCorrectionPolicyChangeReviewHistoryConsistencyPresentation'

function response(overrides = {}) {
  return {
    statusId: 'consistent',
    comparisonAvailable: true,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    routingChanged: false,
    ...overrides,
  }
}

describe('policy-change review history consistency presentation', () => {
  it('admits only a fixed descriptive status model', () => {
    expect(normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryConsistency(response({
      actorId: 7,
      distributionDistance: 0.1,
    }))).toEqual({ statusId: 'consistent', comparisonAvailable: true })
  })

  it('rejects authority-bearing, malformed, and incompatible states', () => {
    expect(normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryConsistency(response({
      automaticPolicyChange: true,
    }))).toBeNull()
    expect(normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryConsistency(response({
      statusId: 'consistent',
      comparisonAvailable: false,
    }))).toBeNull()
    expect(normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryConsistency(response({
      statusId: 'apply_policy',
    }))).toBeNull()
  })

  it('uses explanatory status text rather than a verdict or action', () => {
    expect(getPolicyCandidateCorrectionPolicyChangeReviewHistoryConsistencyPresentation('shifted'))
      .toEqual(expect.objectContaining({
        heading: 'Review process changed across a completed-period comparison',
      }))
  })
})
