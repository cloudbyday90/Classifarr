/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  leadingPolicyQuestionDestination,
  policyQuestionCandidateDestinations,
  policyQuestionRecommendation,
} from '@/utils/policyQuestionRecommendationPresentation'

function answer(overrides = {}) {
  return {
    candidate_destinations: [
      { library_id: 7, library_name: 'Movies' },
      { library_id: 8, library_name: 'Family Movies' },
    ],
    recommendation: {
      version: 'policy.runtime_question_recommendation_presentation.v1',
      status_id: 'leading_candidate_available',
      leading_destination: {
        library_id: 7,
        library_name: 'Movies',
        evidence_score: 75,
      },
      why_not_automatic: {
        reason_id: 'missing_identity_evidence',
        message: 'A score alone does not establish destination identity automatically.',
      },
    },
    ...overrides,
  }
}

describe('policyQuestionRecommendationPresentation', () => {
  it('uses the server candidate label and keeps a valid bounded leading destination', () => {
    const recommendation = policyQuestionRecommendation(answer({
      recommendation: {
        ...answer().recommendation,
        leading_destination: {
          ...answer().recommendation.leading_destination,
          library_name: 'Untrusted replacement label',
        },
      },
    }))

    expect(recommendation.leading_destination).toEqual({
      library_id: 7,
      library_name: 'Movies',
      evidence_score: 75,
    })
    expect(leadingPolicyQuestionDestination(answer())).toEqual({
      library_id: 7,
      library_name: 'Movies',
      evidence_score: 75,
    })
  })

  it('fails closed when a leading destination is not a server candidate', () => {
    expect(policyQuestionRecommendation(answer({
      recommendation: {
        ...answer().recommendation,
        leading_destination: {
          library_id: 999,
          library_name: 'Unknown',
          evidence_score: 75,
        },
      },
    }))).toBeNull()
  })

  it('normalizes the bounded candidate list before alternatives are rendered', () => {
    expect(policyQuestionCandidateDestinations(answer({
      candidate_destinations: [
        { library_id: 7, library_name: 'Movies' },
        { library_id: 7, library_name: 'Duplicate Movies' },
        { library_id: 'not-an-id', library_name: 'Invalid' },
        { library_id: 8, library_name: 'Family Movies\n' },
      ],
    }))).toEqual([
      { library_id: 7, library_name: 'Movies' },
      { library_id: 8, library_name: 'Family Movies' },
    ])
  })
})
