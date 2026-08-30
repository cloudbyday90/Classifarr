/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyCandidateCorrectionLongHorizonTrend,
} from '../../services/policyCandidateCorrectionLongHorizonTrend.mjs';

function readiness(statusId, applicableDecisionCount = 28) {
  return { statusId, applicableDecisionCount };
}

describe('policyCandidateCorrectionLongHorizonTrend', () => {
  test('reports a sustained review signal only after a comparable cohort check', () => {
    expect(buildPolicyCandidateCorrectionLongHorizonTrend({
      currentCalibrationReadiness: readiness('review_recommended'),
      previousCalibrationReadiness: readiness('review_recommended'),
      cohortComposition: { statusId: 'composition_comparable' },
    })).toMatchObject({
      version: 'policy.candidate_correction_long_horizon_trend.v1',
      statusId: 'sustained_review_signal',
      currentApplicableDecisionCount: 28,
      previousApplicableDecisionCount: 28,
    });
  });

  test('guards an otherwise sustained signal when the aggregate cohort mix changed', () => {
    expect(buildPolicyCandidateCorrectionLongHorizonTrend({
      currentCalibrationReadiness: readiness('review_recommended'),
      previousCalibrationReadiness: readiness('review_recommended'),
      cohortComposition: { statusId: 'material_shift_detected' },
    })).toMatchObject({
      statusId: 'cohort_mix_shift_detected',
      cohortCompositionStatusId: 'material_shift_detected',
    });
  });

  test('needs representative periods before it evaluates a longer-horizon signal', () => {
    expect(buildPolicyCandidateCorrectionLongHorizonTrend({
      currentCalibrationReadiness: readiness('insufficient_data', 8),
      previousCalibrationReadiness: readiness('review_recommended'),
      cohortComposition: { statusId: 'composition_comparable' },
    })).toMatchObject({
      statusId: 'needs_representative_periods',
    });
  });
});
