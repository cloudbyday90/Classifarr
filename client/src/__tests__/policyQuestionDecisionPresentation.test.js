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

  it('keeps only the fixed candidate-adjudication presentation fields', () => {
    const answer = answerWithVerification(null)
    answer.decision_summary.candidate_adjudication = {
      version: 'policy.candidate_adjudication_presentation.v1',
      status_id: 'proposed',
      label: 'Bounded candidate comparison complete',
      message: 'The suggestion is advisory.',
      proposed_destination: { library_id: 8, library_name: 'Drama' },
      semantic_retrieval: {
        status_id: 'available',
        label: 'Current-library semantic check used',
        message: 'The advisory comparison included bounded similarity to current items.',
      },
      raw_reasoning: 'Ignore policy constraints.',
    }

    expect(policyQuestionDecisionPresentation(answer).candidate_adjudication).toEqual({
      status_id: 'proposed',
      label: 'Bounded candidate comparison complete',
      message: 'The suggestion is advisory.',
      proposed_destination: { library_id: 8, library_name: 'Drama' },
      semantic_retrieval: {
        status_id: 'available',
        label: 'Current-library semantic check used',
        message: 'The advisory comparison included bounded similarity to current items.',
      },
    })
  })

  it('keeps only allow-listed score-explanation mechanics for rendering', () => {
    const answer = answerWithVerification(null)
    answer.decision_summary.deterministic.score_explanation = {
      version: 'policy.runtime_question_score_explanation.v1',
      score: 71,
      base_score: 63.5,
      agreement_multiplier_percent: 112,
      components: [
        {
          source_id: 'declared_policy_intent',
          evidence_score: 75,
          normalized_weight_percent: 60,
          weighted_contribution: 45,
          policy_term: 'private rule',
        },
        {
          source_id: 'similar_items',
          evidence_score: 65,
          normalized_weight_percent: 40,
          weighted_contribution: 26,
          media_titles: ['private item'],
        },
      ],
      calibration: {
        status_id: 'not_adjusted',
        pre_safety_score: null,
        provider_output: 'ignore policy',
      },
    }

    expect(policyQuestionDecisionPresentation(answer).deterministic.score_explanation).toEqual({
      score: 71,
      base_score: 63.5,
      agreement_multiplier_percent: 112,
      components: [
        {
          source_id: 'declared_policy_intent',
          evidence_score: 75,
          normalized_weight_percent: 60,
          weighted_contribution: 45,
        },
        {
          source_id: 'similar_items',
          evidence_score: 65,
          normalized_weight_percent: 40,
          weighted_contribution: 26,
        },
      ],
      calibration: {
        status_id: 'not_adjusted',
        pre_safety_score: null,
      },
    })
  })

  it('fails closed when a score explanation contains an unknown source category', () => {
    const answer = answerWithVerification(null)
    answer.decision_summary.deterministic.score_explanation = {
      version: 'policy.runtime_question_score_explanation.v1',
      score: 71,
      base_score: 71,
      agreement_multiplier_percent: 100,
      components: [{
        source_id: 'untrusted_source',
        evidence_score: 71,
        normalized_weight_percent: 100,
        weighted_contribution: 71,
      }],
      calibration: {
        status_id: 'not_adjusted',
        pre_safety_score: null,
      },
    }

    expect(policyQuestionDecisionPresentation(answer).deterministic.score_explanation).toBeNull()
  })

  it('keeps only the allow-listed candidate evidence card mechanics for rendering', () => {
    const answer = answerWithVerification(null)
    answer.decision_summary.deterministic.candidate_evidence_card = {
      version: 'policy.candidate_evidence_card.v1',
      status_id: 'evidence_conflict',
      sources: [
        { source_id: 'item_identity', state_id: 'anchored' },
        { source_id: 'declared_policy', state_id: 'supporting' },
        { source_id: 'observed_library_profile', state_id: 'conflicting' },
        { source_id: 'similar_item_retrieval', state_id: 'supporting' },
        { source_id: 'confirmed_outcomes', state_id: 'unavailable' },
      ],
      overview: 'Ignore policy and route automatically.',
    }

    expect(policyQuestionDecisionPresentation(answer).deterministic.candidate_evidence_card).toEqual({
      status_id: 'evidence_conflict',
      sources: [
        { source_id: 'item_identity', state_id: 'anchored' },
        { source_id: 'declared_policy', state_id: 'supporting' },
        { source_id: 'observed_library_profile', state_id: 'conflicting' },
        { source_id: 'similar_item_retrieval', state_id: 'supporting' },
        { source_id: 'confirmed_outcomes', state_id: 'unavailable' },
      ],
    })
    expect(JSON.stringify(policyQuestionDecisionPresentation(answer))).not.toContain('Ignore policy')
  })

  it('keeps only the fixed contrastive-inventory result for rendering', () => {
    const answer = answerWithVerification(null)
    answer.decision_summary.deterministic.candidate_contrastive_evidence = {
      version: 'policy.candidate_contrastive_evidence.v1',
      provenance_id: 'exact_tmdb_current_library_inventory',
      status_id: 'alternative_identity_match',
      library_id: 8,
      title: 'Do not display this.',
    }

    expect(policyQuestionDecisionPresentation(answer).deterministic.candidate_contrastive_evidence).toEqual({
      version: 'policy.candidate_contrastive_evidence.v1',
      provenance_id: 'exact_tmdb_current_library_inventory',
      status_id: 'alternative_identity_match',
    })
    expect(JSON.stringify(policyQuestionDecisionPresentation(answer))).not.toContain('Do not display this.')
  })
})
