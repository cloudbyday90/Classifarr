/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyCandidateCorrectionTemporalStability,
} from '../../services/policyCandidateCorrectionTemporalStability.mjs';

function readiness(statusId, applicableDecisionCount = 20) {
  return { statusId, applicableDecisionCount };
}

describe('policyCandidateCorrectionTemporalStability', () => {
  test('recognizes a review signal only when it repeats in adjacent windows', () => {
    expect(buildPolicyCandidateCorrectionTemporalStability({
      currentCalibrationReadiness: readiness('review_recommended'),
      previousCalibrationReadiness: readiness('review_recommended'),
    })).toMatchObject({
      version: 'policy.candidate_correction_temporal_stability.v1',
      statusId: 'persistent_review_signal',
      currentStatusId: 'review_recommended',
      previousStatusId: 'review_recommended',
    });
  });

  test.each([
    ['review_recommended', 'no_material_signal', 'emerging_review_signal'],
    ['no_material_signal', 'review_recommended', 'diminishing_review_signal'],
    ['no_material_signal', 'no_material_signal', 'stable_no_material_signal'],
    ['inconclusive', 'no_material_signal', 'inconclusive'],
    ['review_recommended', 'insufficient_data', 'insufficient_comparison_data'],
  ])('reports %s after %s as %s without making a tuning decision', (
    currentStatusId,
    previousStatusId,
    statusId,
  ) => {
    expect(buildPolicyCandidateCorrectionTemporalStability({
      currentCalibrationReadiness: readiness(currentStatusId),
      previousCalibrationReadiness: readiness(previousStatusId, 0),
    })).toMatchObject({ statusId });
  });

  test('rejects unknown calibration state instead of passing it through', () => {
    expect(() => buildPolicyCandidateCorrectionTemporalStability({
      currentCalibrationReadiness: readiness('unknown'),
      previousCalibrationReadiness: readiness('review_recommended'),
    })).toThrow('Valid correction calibration-readiness snapshots are required.');
  });
});
