/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  POLICY_CANDIDATE_DECISION_BAND_IDS,
  resolvePolicyCandidateDecisionBand,
} from '../../services/policyCandidateDecisionBand.mjs';

function resolve(score, { promptThreshold = 60, autoClassifyThreshold = 85 } = {}) {
  return resolvePolicyCandidateDecisionBand({ score, promptThreshold, autoClassifyThreshold });
}

describe('policy candidate decision band', () => {
  test.each([
    [39, POLICY_CANDIDATE_DECISION_BAND_IDS.MANUAL_REVIEW, 'manual'],
    [40, POLICY_CANDIDATE_DECISION_BAND_IDS.OPERATOR_SELECTION, 'prompt_select'],
    [59, POLICY_CANDIDATE_DECISION_BAND_IDS.OPERATOR_SELECTION, 'prompt_select'],
    [60, POLICY_CANDIDATE_DECISION_BAND_IDS.OPERATOR_CONFIRMATION, 'prompt_confirm'],
    [84, POLICY_CANDIDATE_DECISION_BAND_IDS.OPERATOR_CONFIRMATION, 'prompt_confirm'],
    [85, POLICY_CANDIDATE_DECISION_BAND_IDS.AUTOMATIC_CANDIDATE, 'auto_classify'],
  ])('resolves the fixed default score boundary at %i', (score, bandId, action) => {
    expect(resolve(score)).toEqual(expect.objectContaining({ bandId, action }));
  });

  test('preserves a configured policy profile while retaining the fixed selection floor', () => {
    expect(resolve(71, { promptThreshold: 72, autoClassifyThreshold: 91 })).toEqual(
      expect.objectContaining({
        bandId: POLICY_CANDIDATE_DECISION_BAND_IDS.OPERATOR_SELECTION,
        action: 'prompt_select',
      }),
    );
    expect(resolve(72, { promptThreshold: 72, autoClassifyThreshold: 91 })).toEqual(
      expect.objectContaining({
        bandId: POLICY_CANDIDATE_DECISION_BAND_IDS.OPERATOR_CONFIRMATION,
        action: 'prompt_confirm',
      }),
    );
    expect(resolve(91, { promptThreshold: 72, autoClassifyThreshold: 91 })).toEqual(
      expect.objectContaining({
        bandId: POLICY_CANDIDATE_DECISION_BAND_IDS.AUTOMATIC_CANDIDATE,
        action: 'auto_classify',
      }),
    );
  });

  test('fails closed and never grants route, policy, or AI authority', () => {
    const result = resolvePolicyCandidateDecisionBand({
      score: Number.NaN,
      promptThreshold: 60,
      autoClassifyThreshold: 85,
    });

    expect(result).toEqual(expect.objectContaining({
      bandId: POLICY_CANDIDATE_DECISION_BAND_IDS.MANUAL_REVIEW,
      action: 'manual',
      automaticRouteAuthorized: false,
      automaticActions: {
        aiInvocation: false,
        learning: false,
        policyChange: false,
        retry: false,
        routing: false,
      },
    }));
  });
});
