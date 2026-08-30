/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  getPolicyCandidateCorrectionRepresentativeReviewHandoff,
} from '@/utils/policyCandidateCorrectionRepresentativeReviewHandoffPresentation'

describe('policyCandidateCorrectionRepresentativeReviewHandoffPresentation', () => {
  it('exposes one fixed existing-review destination only for a sustained signal', () => {
    const handoff = getPolicyCandidateCorrectionRepresentativeReviewHandoff(
      'sustained_review_signal',
    )

    expect(handoff).toMatchObject({
      heading: 'Representative decision review is ready',
      linkLabel: 'Open Needs Attention decisions',
      to: { name: 'CommandCenter', hash: '#needs-attention' },
    })
    expect(Object.isFrozen(handoff)).toBe(true)
    expect(Object.isFrozen(handoff.to)).toBe(true)
  })

  it.each([
    'needs_representative_periods',
    'cohort_comparison_needs_observations',
    'cohort_mix_shift_detected',
    'sustained_low_signal',
    'mixed_signal',
    'unknown',
    null,
  ])('does not create a handoff for %s', (statusId) => {
    expect(getPolicyCandidateCorrectionRepresentativeReviewHandoff(statusId)).toBeNull()
  })
})
