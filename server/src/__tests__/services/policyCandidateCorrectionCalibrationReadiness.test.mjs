/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_STATUS_IDS,
  buildPolicyCandidateCorrectionCalibrationReadiness,
} from '../../services/policyCandidateCorrectionCalibrationReadiness.mjs';

describe('policyCandidateCorrectionCalibrationReadiness', () => {
  test('withholds an interpretation below the fixed applicable-decision floor', () => {
    expect(buildPolicyCandidateCorrectionCalibrationReadiness({
      applicableDecisionCount: 19,
      changedSelectionOutcomeCount: 19,
    })).toMatchObject({
      statusId: POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_STATUS_IDS.INSUFFICIENT_DATA,
      minimumApplicableDecisionCount: 20,
      reviewThresholdPercent: 20,
      changedSelectionRatePercent: 100,
    });
  });

  test('recommends human review only when the full interval reaches the fixed floor', () => {
    expect(buildPolicyCandidateCorrectionCalibrationReadiness({
      applicableDecisionCount: 20,
      changedSelectionOutcomeCount: 10,
    })).toMatchObject({
      statusId: POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_STATUS_IDS.REVIEW_RECOMMENDED,
      changedSelectionConfidenceInterval: {
        methodId: 'wilson_score',
        confidenceLevelPercent: 95,
        lowerRatePercent: 29.9,
        upperRatePercent: 70.1,
      },
    });
  });

  test('keeps a boundary-spanning cohort inconclusive', () => {
    expect(buildPolicyCandidateCorrectionCalibrationReadiness({
      applicableDecisionCount: 20,
      changedSelectionOutcomeCount: 2,
    })).toMatchObject({
      statusId: POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_STATUS_IDS.INCONCLUSIVE,
      changedSelectionConfidenceInterval: {
        lowerRatePercent: 2.8,
        upperRatePercent: 30.1,
      },
    });
  });

  test('reports no material selection-change signal only when the full interval is below the floor', () => {
    expect(buildPolicyCandidateCorrectionCalibrationReadiness({
      applicableDecisionCount: 20,
      changedSelectionOutcomeCount: 0,
    })).toMatchObject({
      statusId: POLICY_CANDIDATE_CORRECTION_CALIBRATION_READINESS_STATUS_IDS.NO_MATERIAL_SIGNAL,
      changedSelectionConfidenceInterval: {
        lowerRatePercent: 0,
        upperRatePercent: 16.1,
      },
    });
  });
});
