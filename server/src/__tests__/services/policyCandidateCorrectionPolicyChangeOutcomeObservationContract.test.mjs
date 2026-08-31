/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildPolicyCandidateCorrectionPolicyChangeOutcomeObservationReadModel,
  buildPolicyCandidateCorrectionPolicyChangeOutcomeObservationWindows,
} from '../../services/policyCandidateCorrectionPolicyChangeOutcomeObservationContract.mjs';

const HYPOTHESIS_ID = `pco_${'a'.repeat(32)}`;

function observation(overrides = {}) {
  return {
    hypothesis_id: HYPOTHESIS_ID,
    source_intent_version: 4,
    target_intent_version: 5,
    baseline_window_start_at: '2026-07-04T00:00:00.000Z',
    baseline_window_end_at: '2026-08-01T00:00:00.000Z',
    followup_window_start_at: '2026-08-02T00:00:00.000Z',
    followup_window_end_at: '2026-08-30T00:00:00.000Z',
    outcome_count: 2,
    confirmed_leader_outcome_count: 1,
    changed_to_candidate_outcome_count: 1,
    changed_outside_candidates_outcome_count: 0,
    routed_not_applicable_outcome_count: 0,
    created_at: '2026-08-01T12:00:00.000Z',
    expires_at: '2026-09-29T00:00:00.000Z',
    ...overrides,
  };
}

describe('policy-change outcome observation contract', () => {
  test('uses distinct completed baseline and follow-up UTC-day windows', () => {
    const windows = buildPolicyCandidateCorrectionPolicyChangeOutcomeObservationWindows({
      now: '2026-08-01T12:34:56.000Z',
    });

    expect(windows.baselineWindow).toEqual(expect.objectContaining({
      days: 28,
      start: new Date('2026-07-04T00:00:00.000Z'),
      end: new Date('2026-08-01T00:00:00.000Z'),
    }));
    expect(windows.followupWindow).toEqual(expect.objectContaining({
      days: 28,
      start: new Date('2026-08-02T00:00:00.000Z'),
      end: new Date('2026-08-30T00:00:00.000Z'),
    }));
    expect(windows.expiresAt).toEqual(new Date('2026-09-29T00:00:00.000Z'));
  });

  test('exposes only a content-free aggregate observation and a Wilson interval', () => {
    const result = buildPolicyCandidateCorrectionPolicyChangeOutcomeObservationReadModel({
      observation: observation(),
      now: '2026-08-30T00:00:00.000Z',
      followupSummary: {
        outcomeCount: 2,
        confirmedLeaderOutcomeCount: 0,
        changedToCandidateOutcomeCount: 1,
        changedOutsideCandidatesOutcomeCount: 1,
        routedNotApplicableOutcomeCount: 0,
      },
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: 'outcome_available',
      automaticPolicyChange: false,
      automaticAiRagTuning: false,
      routingChanged: false,
      observation: expect.objectContaining({ hypothesisId: HYPOTHESIS_ID }),
      outcome: expect.objectContaining({ changedSelectionRatePointDifference: 50 }),
    }));
    expect(result.observation.baselineSummary.changedSelectionRateInterval95).toEqual(
      expect.objectContaining({ lowerBound: expect.any(Number), upperBound: expect.any(Number) }),
    );
    expect(JSON.stringify(result)).not.toContain('source_intent_version');
    expect(JSON.stringify(result)).not.toContain('target_intent_version');
    expect(JSON.stringify(result)).not.toContain('policy_id');
  });

  test('fails closed to a no-observation state on a malformed aggregate count partition', () => {
    expect(buildPolicyCandidateCorrectionPolicyChangeOutcomeObservationReadModel({
      observation: observation({ outcome_count: 3 }),
      now: '2026-08-10T00:00:00.000Z',
    })).toEqual(expect.objectContaining({ statusId: 'not_started', observation: null }));
  });
});
