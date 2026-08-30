/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  getPolicyConfirmationEvidenceReviewHandoff,
  isPolicyConfirmationEvidenceReviewFocus,
  POLICY_CONFIRMATION_EVIDENCE_REVIEW_FOCUS,
} from '@/utils/policyConfirmationEvidenceReviewHandoff'

describe('policyConfirmationEvidenceReviewHandoff', () => {
  it('hands off only the fixed declared-scope review state to the existing coverage review', () => {
    expect(getPolicyConfirmationEvidenceReviewHandoff('declared_scope_review_recommended')).toEqual({
      label: 'Review existing policy purpose coverage',
      to: {
        name: 'PolicyNativeIntentReconciliation',
        query: { focus: 'purpose-coverage' },
      },
    })
  })

  it('fails closed for all other and unrecognized readiness states', () => {
    expect(getPolicyConfirmationEvidenceReviewHandoff('evidence_mix_observed')).toBeNull()
    expect(getPolicyConfirmationEvidenceReviewHandoff('provider_supplied_status')).toBeNull()
    expect(getPolicyConfirmationEvidenceReviewHandoff()).toBeNull()
  })

  it('recognizes only the fixed purpose-coverage focus token', () => {
    expect(isPolicyConfirmationEvidenceReviewFocus(
      POLICY_CONFIRMATION_EVIDENCE_REVIEW_FOCUS.PURPOSE_COVERAGE,
    )).toBe(true)
    expect(isPolicyConfirmationEvidenceReviewFocus('17')).toBe(false)
    expect(isPolicyConfirmationEvidenceReviewFocus('provider-supplied')).toBe(false)
  })
})
