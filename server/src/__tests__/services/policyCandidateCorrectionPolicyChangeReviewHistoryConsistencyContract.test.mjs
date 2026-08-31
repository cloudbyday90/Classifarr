/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildPolicyCandidateCorrectionPolicyChangeReviewHistoryConsistencyReadModel,
} from '../../services/policyCandidateCorrectionPolicyChangeReviewHistoryConsistencyContract.mjs';

function period({ retained = 10, investigate = 0, prepare = 0, revised = 1 } = {}) {
  const values = [retained, investigate, prepare];
  return {
    conclusionSummaries: [
      'retain_current_policy',
      'investigate_policy_evidence',
      'prepare_manual_policy_change',
    ].map((decisionId, index) => ({
      decisionId,
      recordedCount: Math.max(values[index] - (index === 0 ? revised : 0), 0),
      revisedCount: index === 0 ? Math.min(revised, values[index]) : 0,
      totalCount: values[index],
    })),
  };
}

describe('policy-change review history consistency contract', () => {
  test('waits for exactly three complete periods and a fixed minimum cohort', () => {
    expect(buildPolicyCandidateCorrectionPolicyChangeReviewHistoryConsistencyReadModel({
      periods: [period(), period()],
    })).toEqual(expect.objectContaining({
      statusId: 'collecting',
      comparisonAvailable: false,
    }));

    expect(buildPolicyCandidateCorrectionPolicyChangeReviewHistoryConsistencyReadModel({
      periods: [period(), period(), period({ retained: 9 })],
    })).toEqual(expect.objectContaining({
      statusId: 'insufficient_activity',
      comparisonAvailable: false,
    }));
  });

  test('reports a consistent process only when both adjacent comparisons remain in fixed bands', () => {
    const result = buildPolicyCandidateCorrectionPolicyChangeReviewHistoryConsistencyReadModel({
      periods: [period(), period({ revised: 2 }), period()],
    });

    expect(result).toEqual({
      statusId: 'consistent',
      comparisonAvailable: true,
      automaticPolicyChange: false,
      automaticAiRagTuning: false,
      routingChanged: false,
    });
  });

  test('reports a shift without exposing metrics, counts, dates, or identity', () => {
    const result = buildPolicyCandidateCorrectionPolicyChangeReviewHistoryConsistencyReadModel({
      periods: [period({ retained: 5, investigate: 5 }), period(), period()],
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: 'shifted',
      comparisonAvailable: true,
    }));
    expect(JSON.stringify(result)).not.toMatch(/distance|revisionRate|totalActivity|periodStart|actor|media/iu);
  });

  test('fails closed when a period contains an unexpected conclusion dimension', () => {
    const invalidPeriod = period();
    invalidPeriod.conclusionSummaries[1].decisionId = 'apply_policy';

    expect(buildPolicyCandidateCorrectionPolicyChangeReviewHistoryConsistencyReadModel({
      periods: [period(), invalidPeriod, period()],
    })).toEqual(expect.objectContaining({
      statusId: 'collecting',
      comparisonAvailable: false,
    }));
  });
});
