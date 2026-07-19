/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildPolicyObservedSuggestionProjection,
  toSelectableObservedSuggestion,
} from '../../services/policyObservedSuggestionCandidates.mjs';

describe('policyObservedSuggestionCandidates', () => {
  test('keeps observed library values separate from eligible selectable suggestions', () => {
    const result = buildPolicyObservedSuggestionProjection({
      profileEvidence: {
        libraryProfile: {
          compatibilityCandidates: [
            { key: 'genre:animation', label: 'Animation', count: 42, confidence: 0.84 },
            { key: 'rating:pg', label: 'PG', count: 28, confidence: 0.56 },
            { key: 'studio:ghibli', label: 'Studio Ghibli', count: 12, confidence: 0.24 },
          ],
        },
      },
    });

    expect(result.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'genre:animation',
        sourceId: 'observed_in_library',
        requiresExplicitAcceptance: true,
      }),
      expect.objectContaining({ key: 'rating:pg' }),
    ]));
    expect(result.selectableSuggestions).toEqual([
      expect.objectContaining({
        candidateId: 'genre:animation:purpose',
        value: 'Animation',
        signalType: 'genres',
        operator: 'require_any',
        sourceId: 'suggested_from_observed_profile',
        evidence: { count: 42, confidence: 0.84 },
        requiresExplicitAcceptance: true,
        canAutoDeclare: false,
      }),
      expect.objectContaining({
        candidateId: 'studio:ghibli:purpose',
        signalType: 'studios',
      }),
    ]);
    expect(result.selectableSuggestions.map(candidate => candidate.value)).not.toContain('PG');
  });

  test('does not turn unknown or unsupported observations into selectable intent candidates', () => {
    expect(toSelectableObservedSuggestion({
      key: 'rating:r',
      label: 'R',
      kind: 'rating',
      count: 3,
      confidence: 0.3,
    })).toBeNull();
  });
});
