/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_MAXIMUM_BOOST,
  calibrateCurrentLibraryCandidateSemanticOutcome,
} from '../../services/currentLibraryCandidateSemanticOutcomeCalibration.mjs';

describe('currentLibraryCandidateSemanticOutcomeCalibration', () => {
  test('applies a small advisory boost only to an already-relevant authenticated outcome', () => {
    expect(calibrateCurrentLibraryCandidateSemanticOutcome({
      relevance: 81,
      hasAuthorizedOutcome: true,
    })).toMatchObject({
      relevance: 81 + CURRENT_LIBRARY_CANDIDATE_SEMANTIC_OUTCOME_CALIBRATION_MAXIMUM_BOOST,
      outcomeCalibrated: true,
    });
  });

  test.each([
    ['no receipt', { relevance: 81, hasAuthorizedOutcome: false }],
    ['low semantic relevance', { relevance: 49, hasAuthorizedOutcome: true }],
    ['invalid relevance', { relevance: 'not-a-number', hasAuthorizedOutcome: true }],
  ])('does not calibrate %s', (_label, input) => {
    const result = calibrateCurrentLibraryCandidateSemanticOutcome(input);

    expect(result.outcomeCalibrated).toBe(false);
    expect(result.relevance).toBeLessThanOrEqual(100);
  });

  test('caps a calibrated result at 100', () => {
    expect(calibrateCurrentLibraryCandidateSemanticOutcome({
      relevance: 99,
      hasAuthorizedOutcome: 't',
    })).toMatchObject({ relevance: 100, outcomeCalibrated: true });
  });
});
