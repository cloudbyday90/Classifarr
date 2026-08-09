/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyRuntimeQuestionDecisionPresentation,
} from '../../services/policyRuntimeQuestionDecisionPresentation.mjs';

const candidates = [{ library_id: 5, library_name: 'Movies' }];

describe('policyRuntimeQuestionDecisionPresentation', () => {
  test('projects deterministic thresholds and bounded evidence facts', () => {
    const presentation = buildPolicyRuntimeQuestionDecisionPresentation({
      classification: {
        confidence: 75.16,
        metadata: {
          policyResult: {
            thresholds: { prompt: 60, auto_classify: 85 },
          },
        },
      },
      question: {
        meta: {
          candidates: [{
            library_id: 5,
            candidate_diagnostics: {
              positive_sources: { rag: true, profile: true },
              native_intent_runtime: {
                eligible: true,
                rule_counts: { purpose: 1 },
              },
            },
          }],
        },
      },
      candidateDestinations: candidates,
    });

    expect(presentation.deterministic).toMatchObject({
      status_id: 'confirmation_required',
      destination: { library_id: 5, library_name: 'Movies' },
      score: 75,
      review_threshold: 60,
      automatic_threshold: 85,
    });
    expect(presentation.deterministic.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'declared_intent' }),
      expect.objectContaining({ id: 'similar_items' }),
      expect.objectContaining({ id: 'observed_profile' }),
    ]));
  });

  test('uses the current candidate-bound policy score for a destination-selection review', () => {
    const presentation = buildPolicyRuntimeQuestionDecisionPresentation({
      classification: {
        confidence: 90,
        metadata: {
          policyResult: {
            action: 'prompt_select',
            thresholds: { prompt: 60, auto_classify: 85 },
            ranked: [
              {
                library_id: 5,
                score: 80,
                prompt_threshold: 60,
                auto_classify_threshold: 85,
                candidate_diagnostics: {
                  native_intent_runtime: {
                    eligible: true,
                    rule_counts: { purpose: 1 },
                  },
                },
              },
              { library_id: 6, score: 80 },
              { library_id: 7, score: 80 },
            ],
          },
        },
      },
      question: {
        meta: {
          candidates: [{ library_id: 5, score: 82 }],
        },
      },
      candidateDestinations: candidates,
    });

    expect(presentation.deterministic).toMatchObject({
      status_id: 'destination_selection_required',
      destination: { library_id: 5, library_name: 'Movies' },
      score: 80,
      review_threshold: 60,
      automatic_threshold: 85,
    });
    expect(presentation.deterministic.message).toContain('did not establish a unique destination');
    expect(presentation.deterministic.message).not.toContain('automatic policy threshold');
  });

  test('retains a structured advisory alternative without provider raw output', () => {
    const presentation = buildPolicyRuntimeQuestionDecisionPresentation({
      classification: {
        metadata: {
          classification_details: {
            ai_advisory: {
              version: 'classification.ai_advisory.v1',
              status_id: 'alternative_selected',
              message: 'The model proposed "Drama" instead of "Movies".',
              proposed_destination: { library_id: 8, library_name: 'Drama' },
            },
          },
        },
      },
      candidateDestinations: candidates,
    });

    expect(presentation.ai_advisory).toEqual({
      status_id: 'alternative_selected',
      message: 'The model proposed "Drama" instead of "Movies".',
      proposed_destination: { library_id: 8, library_name: 'Drama' },
    });
  });

  test('explains when observed profile absence is advisory to declared intent', () => {
    const presentation = buildPolicyRuntimeQuestionDecisionPresentation({
      classification: { confidence: 80 },
      question: {
        meta: {
          candidates: [{
            library_id: 5,
            candidate_diagnostics: {
              native_intent_runtime: {
                eligible: true,
                rule_counts: { purpose: 1 },
              },
              profile_observed_absence_advisory: true,
            },
          }],
        },
      },
      candidateDestinations: candidates,
    });

    expect(presentation.deterministic.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'declared_intent' }),
      expect.objectContaining({ id: 'observed_profile_difference' }),
    ]));
  });

  test('states when the AI verification aligns with the deterministic destination', () => {
    const presentation = buildPolicyRuntimeQuestionDecisionPresentation({
      classification: {
        method: 'ai_verified',
      },
      candidateDestinations: candidates,
    });

    expect(presentation.ai_advisory).toEqual({
      status_id: 'aligned_with_deterministic',
      message: 'AI verification aligned with Movies. It remains advisory and did not determine the policy outcome.',
      proposed_destination: null,
    });
  });

  test('describes historic disagreement honestly when its normalized alternative was not retained', () => {
    const presentation = buildPolicyRuntimeQuestionDecisionPresentation({
      classification: {
        reason: 'Needs clarification: AI disagreed with suggested classification',
      },
      candidateDestinations: candidates,
    });

    expect(presentation.ai_advisory).toMatchObject({
      status_id: 'historic_advisory_not_retained',
      proposed_destination: null,
    });
  });
});
