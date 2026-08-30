/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyCandidateCorrectionCohortCompositionComparison,
} from '../../services/policyCandidateCorrectionCohortComposition.mjs';

describe('policyCandidateCorrectionCohortComposition', () => {
  test('identifies a material fixed-bucket composition shift after both cohorts reach the floor', () => {
    expect(buildPolicyCandidateCorrectionCohortCompositionComparison({
      bucketIds: ['very_close', 'close', 'clear', 'decisive'],
      currentCountsByBucketId: { very_close: 50, close: 30, clear: 20, decisive: 0 },
      previousCountsByBucketId: { very_close: 30, close: 30, clear: 30, decisive: 10 },
    })).toMatchObject({
      version: 'policy.candidate_correction_cohort_composition.v1',
      statusId: 'material_shift_detected',
      currentObservationCount: 100,
      previousObservationCount: 100,
      totalVariationDistancePercent: 20,
    });
  });

  test('reports comparable composition below the material shift threshold', () => {
    expect(buildPolicyCandidateCorrectionCohortCompositionComparison({
      bucketIds: ['one', 'two'],
      currentCountsByBucketId: { one: 12, two: 8 },
      previousCountsByBucketId: { one: 10, two: 10 },
    })).toMatchObject({
      statusId: 'composition_comparable',
      totalVariationDistancePercent: 10,
    });
  });

  test('does not calculate a distance until both aggregate cohorts reach the floor', () => {
    expect(buildPolicyCandidateCorrectionCohortCompositionComparison({
      bucketIds: ['one', 'two'],
      currentCountsByBucketId: { one: 19, two: 0 },
      previousCountsByBucketId: { one: 10, two: 10 },
    })).toMatchObject({
      statusId: 'insufficient_data',
      totalVariationDistancePercent: null,
    });
  });
});
