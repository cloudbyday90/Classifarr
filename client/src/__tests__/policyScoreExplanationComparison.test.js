/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  POLICY_SCORE_EXPLANATION_COMPARISON_MAXIMUM_ENTRIES,
  buildPolicyScoreExplanationComparison,
  policyScoreExplanationComparisonEntry,
} from '@/utils/policyScoreExplanationComparison'

function decisionPresentation(overrides = {}) {
  return {
    deterministic: {
      score: 71,
      review_threshold: 60,
      automatic_threshold: 85,
      score_explanation: {
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
            evidence_score: 56,
            normalized_weight_percent: 40,
            weighted_contribution: 22.3,
          },
        ],
        calibration: {
          status_id: 'not_adjusted',
          pre_safety_score: null,
        },
      },
      ...overrides,
    },
  }
}

describe('policyScoreExplanationComparison', () => {
  it('creates a bounded identity-free comparison from valid presentations', () => {
    const first = decisionPresentation()
    first.deterministic.destination = { library_id: 4, library_name: 'Do not show' }
    first.deterministic.score_explanation.provider_output = 'Do not show'
    const second = decisionPresentation({
      score: 68,
      score_explanation: {
        ...decisionPresentation().deterministic.score_explanation,
        score: 68,
        base_score: 61.2,
        components: [{
          source_id: 'observed_library_contents',
          evidence_score: 68,
          normalized_weight_percent: 100,
          weighted_contribution: 61.2,
        }],
      },
    })

    expect(buildPolicyScoreExplanationComparison([first, second])).toEqual({
      selected_explanation_count: 2,
      score_range: { minimum: 68, maximum: 71 },
      entries: [
        {
          score: 71,
          base_score: 63.5,
          agreement_multiplier_percent: 112,
          review_threshold: 60,
          automatic_threshold: 85,
          components: [
            {
              source_id: 'declared_policy_intent',
              evidence_score: 75,
              normalized_weight_percent: 60,
              weighted_contribution: 45,
            },
            {
              source_id: 'similar_items',
              evidence_score: 56,
              normalized_weight_percent: 40,
              weighted_contribution: 22.3,
            },
          ],
          calibration: { status_id: 'not_adjusted', pre_safety_score: null },
        },
        {
          score: 68,
          base_score: 61.2,
          agreement_multiplier_percent: 112,
          review_threshold: 60,
          automatic_threshold: 85,
          components: [
            {
              source_id: 'observed_library_contents',
              evidence_score: 68,
              normalized_weight_percent: 100,
              weighted_contribution: 61.2,
            },
          ],
          calibration: { status_id: 'not_adjusted', pre_safety_score: null },
        },
      ],
      source_coverage: [
        { source_id: 'declared_policy_intent', selected_explanation_count: 1 },
        { source_id: 'observed_library_contents', selected_explanation_count: 1 },
        { source_id: 'similar_items', selected_explanation_count: 1 },
      ],
    })
  })

  it('fails closed for an unknown evidence category', () => {
    const invalid = decisionPresentation()
    invalid.deterministic.score_explanation.components[0].source_id = 'provider_reasoning'

    expect(policyScoreExplanationComparisonEntry(invalid)).toBeNull()
  })

  it('fails closed for an out-of-range evidence-safety score', () => {
    const invalid = decisionPresentation()
    invalid.deterministic.score_explanation.calibration.pre_safety_score = 101

    expect(policyScoreExplanationComparisonEntry(invalid)).toBeNull()
  })

  it('requires two valid entries and caps the comparison at three', () => {
    const entries = Array.from({ length: 4 }, (_, index) => decisionPresentation({
      score: 70 + index,
      score_explanation: {
        ...decisionPresentation().deterministic.score_explanation,
        score: 70 + index,
      },
    }))

    expect(buildPolicyScoreExplanationComparison([entries[0]])).toBeNull()
    expect(buildPolicyScoreExplanationComparison(entries)?.entries).toHaveLength(
      POLICY_SCORE_EXPLANATION_COMPARISON_MAXIMUM_ENTRIES,
    )
    expect(buildPolicyScoreExplanationComparison(entries)?.score_range).toEqual({
      minimum: 70,
      maximum: 72,
    })
  })
})
