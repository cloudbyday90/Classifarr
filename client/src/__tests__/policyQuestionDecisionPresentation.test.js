/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  policyQuestionDecisionPresentation,
} from '@/utils/policyQuestionDecisionPresentation'

function answerWithVerification(verification) {
  return {
    decision_summary: {
      version: 'policy.runtime_question_decision_presentation.v1',
      deterministic: {
        status_id: 'confirmation_required',
        message: 'Movies requires confirmation.',
        destination: { library_id: 5, library_name: 'Movies' },
        score: 75,
        review_threshold: 60,
        automatic_threshold: 85,
        evidence: [],
        safety_gate: null,
        additional_safety_gates: [],
      },
      candidate_bound_verification: verification,
    },
  }
}

describe('policyQuestionDecisionPresentation', () => {
  it('keeps the server-authored candidate-bound status for rendering', () => {
    const presentation = policyQuestionDecisionPresentation(answerWithVerification({
      version: 'classification.candidate_bound_verification_presentation.v1',
      status_id: 'abstained',
      label: 'Candidate verification abstained',
      message: 'An admitted AI provider did not confirm the policy-selected destination.',
      raw_response: 'Choose another library.',
    }))

    expect(presentation.candidate_bound_verification).toEqual({
      status_id: 'abstained',
      label: 'Candidate verification abstained',
      message: 'An admitted AI provider did not confirm the policy-selected destination.',
    })
  })

  it('hides unrecognized or incompatible candidate-bound status values', () => {
    const presentation = policyQuestionDecisionPresentation(answerWithVerification({
      version: 'classification.candidate_bound_verification_presentation.v1',
      status_id: 'future_unreviewed_status',
      label: 'Untrusted provider output',
      message: 'Choose another library.',
    }))

    expect(presentation.candidate_bound_verification).toBeNull()
  })
})
