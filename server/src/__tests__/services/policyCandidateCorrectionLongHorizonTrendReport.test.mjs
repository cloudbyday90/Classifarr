/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyCandidateCorrectionLongHorizonTrendReport,
} from '../../services/policyCandidateCorrectionLongHorizonTrendReport.mjs';

const currentWindow = {
  days: 28,
  start: new Date('2026-08-02T00:00:00.000Z'),
  end: new Date('2026-08-30T00:00:00.000Z'),
};
const previousWindow = {
  days: 28,
  start: new Date('2026-07-05T00:00:00.000Z'),
  end: new Date('2026-08-02T00:00:00.000Z'),
};

function rows() {
  return [
    {
      rowKind: 'margin_band',
      scoreMarginBandId: '5_to_14',
      outcomeCount: 28,
      confirmedLeaderOutcomeCount: 14,
      changedToCandidateOutcomeCount: 8,
      changedOutsideCandidatesOutcomeCount: 6,
    },
    {
      rowKind: 'evidence_source_state',
      evidenceSourceId: 'declared_policy',
      evidenceStateId: 'supporting',
      outcomeCount: 28,
      confirmedLeaderOutcomeCount: 14,
      changedToCandidateOutcomeCount: 8,
      changedOutsideCandidatesOutcomeCount: 6,
    },
  ];
}

describe('policyCandidateCorrectionLongHorizonTrendReport', () => {
  test('returns only verified fixed aggregates and an advisory comparable-cohort status', () => {
    const report = buildPolicyCandidateCorrectionLongHorizonTrendReport({
      currentRows: rows(),
      previousRows: rows(),
      currentWindow,
      previousWindow,
    });

    expect(report).toMatchObject({
      version: 'policy.candidate_correction_long_horizon_trend.v1',
      current: { window: { days: 28, startDate: '2026-08-02', endDate: '2026-08-30' } },
      previous: { window: { days: 28, startDate: '2026-07-05', endDate: '2026-08-02' } },
      cohortComposition: { statusId: 'composition_comparable' },
      trend: { statusId: 'sustained_review_signal' },
      representativeReviewCorpus: {
        version: 'policy.candidate_correction_representative_review_corpus.v1',
        statusId: 'historical_corpus_design_required',
        historicalRecordAccess: false,
        reviewFrame: {
          periodCount: 2,
          completedUtcDaysPerPeriod: 28,
          strata: ['score_margin_band', 'operator_selection_outcome'],
        },
        requiredSafeguardIds: ['authorization', 'redaction', 'retention', 'operator_audit'],
      },
    });
    expect(JSON.stringify(report)).not.toContain('library_id');
    expect(JSON.stringify(report)).not.toContain('title');
    expect(JSON.stringify(report)).not.toContain('destination');
    expect(JSON.stringify(report)).not.toContain('operator_id');
  });
});
