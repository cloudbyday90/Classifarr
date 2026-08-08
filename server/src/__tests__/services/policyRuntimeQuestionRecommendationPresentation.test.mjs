/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, test } from '@jest/globals';

import {
  POLICY_RUNTIME_QUESTION_RECOMMENDATION_PRESENTATION_VERSION,
  POLICY_RUNTIME_QUESTION_RECOMMENDATION_STATUS_IDS,
  buildPolicyRuntimeQuestionRecommendationPresentation,
} from '../../services/policyRuntimeQuestionRecommendationPresentation.mjs';
import {
  POLICY_RUNTIME_QUESTION_NORMALIZATION_VERSION,
} from '../../services/policyRuntimeQuestionNormalizer.mjs';

function question(overrides = {}) {
  return {
    meta: {
      candidates: [
        {
          library_id: 7,
          library_name: 'Movies',
          score: 75.4,
          policy_id: 99,
          policy_name: 'Private policy name',
          candidate_diagnostics: { provider_response: 'must not be projected' },
        },
        {
          library_id: 8,
          library_name: 'Family Movies',
          score: 68,
        },
      ],
      runtime_question_normalization: {
        version: POLICY_RUNTIME_QUESTION_NORMALIZATION_VERSION,
        uncertainty_type: 'missing_identity_evidence',
      },
    },
    ...overrides,
  };
}

const destinations = [
  { library_id: 7, library_name: 'Movies' },
  { library_id: 8, library_name: 'Family Movies' },
];

describe('policyRuntimeQuestionRecommendationPresentation', () => {
  test('projects only the unique leading destination and bounded automation stop reason', () => {
    const presentation = buildPolicyRuntimeQuestionRecommendationPresentation({
      question: question(),
      candidateDestinations: destinations,
    });

    expect(presentation).toEqual({
      version: POLICY_RUNTIME_QUESTION_RECOMMENDATION_PRESENTATION_VERSION,
      status_id: POLICY_RUNTIME_QUESTION_RECOMMENDATION_STATUS_IDS.LEADING_CANDIDATE_AVAILABLE,
      leading_destination: {
        library_id: 7,
        library_name: 'Movies',
        evidence_score: 75,
      },
      why_not_automatic: {
        reason_id: 'missing_identity_evidence',
        message: 'A score alone does not establish destination identity automatically.',
      },
      alternative_candidate_count: 1,
    });
    expect(JSON.stringify(presentation)).not.toContain('Private policy name');
    expect(JSON.stringify(presentation)).not.toContain('must not be projected');
  });

  test('withholds a leading action when the highest safe score is tied', () => {
    const presentation = buildPolicyRuntimeQuestionRecommendationPresentation({
      question: question({
        meta: {
          ...question().meta,
          candidates: [
            { library_id: 7, score: 75 },
            { library_id: 8, score: 75 },
          ],
        },
      }),
      candidateDestinations: destinations,
    });

    expect(presentation).toMatchObject({
      status_id: POLICY_RUNTIME_QUESTION_RECOMMENDATION_STATUS_IDS.MANUAL_DESTINATION_SELECTION_REQUIRED,
      leading_destination: null,
      alternative_candidate_count: 2,
    });
  });

  test('does not present recommendations for native persistence questions', () => {
    expect(buildPolicyRuntimeQuestionRecommendationPresentation({
      question: { meta: { runtime_question_persistence: { destinationLibraryId: 7 } } },
      candidateDestinations: destinations,
    })).toBeNull();
  });
});
