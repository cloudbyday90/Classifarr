/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyCandidateCorrectionTemporalStabilityReport,
} from '../../services/policyCandidateCorrectionTemporalStabilityReport.mjs';

const currentWindow = {
  days: 7,
  start: new Date('2026-08-23T00:00:00.000Z'),
  end: new Date('2026-08-30T00:00:00.000Z'),
};
const previousWindow = {
  days: 7,
  start: new Date('2026-08-16T00:00:00.000Z'),
  end: new Date('2026-08-23T00:00:00.000Z'),
};

function reviewRows({ evidenceSourceId = 'declared_policy' } = {}) {
  return [
    {
      rowKind: 'margin_band',
      scoreMarginBandId: '5_to_14',
      outcomeCount: 20,
      confirmedLeaderOutcomeCount: 10,
      changedToCandidateOutcomeCount: 6,
      changedOutsideCandidatesOutcomeCount: 4,
    },
    {
      rowKind: 'evidence_source_state',
      evidenceSourceId,
      evidenceStateId: 'supporting',
      outcomeCount: 20,
      confirmedLeaderOutcomeCount: 10,
      changedToCandidateOutcomeCount: 6,
      changedOutsideCandidatesOutcomeCount: 4,
    },
  ];
}

describe('policyCandidateCorrectionTemporalStabilityReport', () => {
  test('keeps both windows aggregate-only and exposes a repeated review signal', () => {
    const report = buildPolicyCandidateCorrectionTemporalStabilityReport({
      currentRows: reviewRows(),
      previousRows: reviewRows({ evidenceSourceId: 'similar_item_retrieval' }),
      currentWindow,
      previousWindow,
    });

    expect(report).toMatchObject({
      version: 'policy.candidate_correction_analytics_metrics.v4',
      window: { startDate: '2026-08-23', endDate: '2026-08-30' },
      previousWindow: { startDate: '2026-08-16', endDate: '2026-08-23' },
      temporalStability: {
        version: 'policy.candidate_correction_temporal_stability.v1',
        summary: { statusId: 'persistent_review_signal' },
      },
      cohortComposition: {
        version: 'policy.candidate_correction_cohort_composition.v1',
        statusId: 'insufficient_data',
      },
    });
    expect(report.temporalStability.marginBuckets).toContainEqual(expect.objectContaining({
      marginBandId: '5_to_14',
      stability: expect.objectContaining({ statusId: 'persistent_review_signal' }),
    }));
    expect(report.temporalStability.evidenceSourceStateBuckets).toHaveLength(2);
    expect(JSON.stringify(report)).not.toContain('library_id');
    expect(JSON.stringify(report)).not.toContain('title');
    expect(JSON.stringify(report)).not.toContain('destination');
  });
});
