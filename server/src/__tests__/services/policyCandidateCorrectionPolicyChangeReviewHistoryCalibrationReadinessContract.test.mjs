/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadinessReadModel,
} from '../../services/policyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadinessContract.mjs';

function period({ retained = 10, investigate = 0, prepare = 0 } = {}) {
  return {
    conclusionSummaries: [
      ['retain_current_policy', retained],
      ['investigate_policy_evidence', investigate],
      ['prepare_manual_policy_change', prepare],
    ].map(([decisionId, totalCount]) => ({
      decisionId,
      recordedCount: totalCount,
      revisedCount: 0,
      totalCount,
    })),
  };
}

describe('policy-change review history calibration readiness contract', () => {
  test('collects until exactly six fixed complete periods are available', () => {
    expect(buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadinessReadModel({
      periods: Array.from({ length: 5 }, () => period()),
    })).toEqual(expect.objectContaining({
      statusId: 'collecting_periods',
      reviewEligible: false,
    }));
  });

  test('requires the fixed activity floor in every completed period', () => {
    expect(buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadinessReadModel({
      periods: [period({ retained: 9 }), ...Array.from({ length: 5 }, () => period())],
    })).toEqual(expect.objectContaining({
      statusId: 'insufficient_activity',
      reviewEligible: false,
    }));
  });

  test('admits a human review only after six well-formed sufficient aggregate periods', () => {
    expect(buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadinessReadModel({
      periods: Array.from({ length: 6 }, () => period()),
    })).toEqual({
      statusId: 'ready_for_human_review',
      reviewEligible: true,
      automaticPolicyChange: false,
      automaticAiRagTuning: false,
      routingChanged: false,
    });
  });

  test('fails closed for a malformed conclusion dimension without returning calculation inputs', () => {
    const malformed = period();
    malformed.conclusionSummaries[0].decisionId = 'apply_policy';
    const result = buildPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationReadinessReadModel({
      periods: [malformed, ...Array.from({ length: 5 }, () => period())],
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: 'collecting_periods',
      reviewEligible: false,
    }));
    expect(JSON.stringify(result)).not.toMatch(/recordedCount|revisedCount|totalCount|distribution|threshold/iu);
  });
});
