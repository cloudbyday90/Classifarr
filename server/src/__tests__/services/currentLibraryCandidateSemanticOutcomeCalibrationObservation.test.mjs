/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildCurrentLibraryCandidateSemanticOutcomeCalibrationObservation,
} from '../../services/currentLibraryCandidateSemanticOutcomeCalibrationObservation.mjs';

describe('currentLibraryCandidateSemanticOutcomeCalibrationObservation', () => {
  test('distinguishes outcome-calibrated semantic matches from other available matches', () => {
    expect(buildCurrentLibraryCandidateSemanticOutcomeCalibrationObservation({
      statusId: 'available',
      candidates: [
        { matchCount: 1, outcomeCalibratedMatchCount: 0 },
        { matchCount: 2, outcomeCalibratedMatchCount: 1 },
      ],
    })).toBe('outcome_calibrated');

    expect(buildCurrentLibraryCandidateSemanticOutcomeCalibrationObservation({
      statusId: 'available',
      candidates: [{ matchCount: 2, outcomeCalibratedMatchCount: 0 }],
    })).toBe('not_outcome_calibrated');
  });

  test('keeps no-match and unavailable retrieval outside the comparison arms', () => {
    expect(buildCurrentLibraryCandidateSemanticOutcomeCalibrationObservation({
      statusId: 'available',
      candidates: [{ matchCount: 0, outcomeCalibratedMatchCount: 3 }],
    })).toBe('no_semantic_match');

    expect(buildCurrentLibraryCandidateSemanticOutcomeCalibrationObservation({
      statusId: 'unavailable',
      candidates: [{ matchCount: 2, outcomeCalibratedMatchCount: 2 }],
    })).toBeNull();
  });
});
