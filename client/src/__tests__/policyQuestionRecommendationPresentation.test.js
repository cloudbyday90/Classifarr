/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { pendingReviewReference } from './fixtures/pendingReviewReference'

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
  it('retains separate v2 policy/advisory references and never manufactures a primary action', () => {
    const value = pendingReviewReference()
    value.recommendation.policy_destination.library_name = 'Untrusted replacement'
    expect(policyQuestionRecommendation(value)).toMatchObject({ version: 'policy.runtime_question_recommendation_presentation.v2',
      leading_destination: null, policy_destination: { library_id: 7, library_name: 'Comedy', evidence_score: 37 },
      advisory_destination: { library_id: 8, library_name: 'Movies' } })
    expect(leadingPolicyQuestionDestination(value)).toBeNull()
  })
  it.each(['unknown_version', 'foreign_policy', 'foreign_advice', 'null_score', 'extra_key', 'forged_primary', 'bad_count', 'duplicate_candidate', 'malformed_id'])('rejects inconsistent v2 %s', kind => {
    const value = pendingReviewReference(), source = value.recommendation
    if (kind === 'unknown_version') source.version += '.future'
    if (kind === 'foreign_policy') source.policy_destination.library_id = 99
    if (kind === 'foreign_advice') source.advisory_destination.library_id = 99
    if (kind === 'null_score') source.policy_destination.evidence_score = null
    if (kind === 'extra_key') source.raw_model_text = 'Never render'
    if (kind === 'forged_primary') { source.status_id = 'leading_candidate_available'; source.leading_destination = source.policy_destination }
    if (kind === 'bad_count') source.alternative_candidate_count = 1
    if (kind === 'duplicate_candidate') value.candidate_destinations.push(value.candidate_destinations[0])
    if (kind === 'malformed_id') source.advisory_destination.library_id = { toString: 'invalid', valueOf: null }
    expect(policyQuestionRecommendation(value)).toBeNull()
    expect(leadingPolicyQuestionDestination(value)).toBeNull()
  })
  it('allows an aligned v2 primary only when its ID and score equal the technical reference', () => {
    const value = pendingReviewReference(), source = value.recommendation
    source.advisory_destination = null
    source.leading_destination = { ...source.policy_destination }
    source.status_id = 'leading_candidate_available'
    source.alternative_candidate_count = 1
    source.why_not_automatic = { reason_id: 'missing_identity_evidence', message: 'Review required.' }
    expect(leadingPolicyQuestionDestination(value)).toMatchObject({ library_id: 7, evidence_score: 37 })
    source.leading_destination.evidence_score = 38
    expect(policyQuestionRecommendation(value)).toBeNull()
  })
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
