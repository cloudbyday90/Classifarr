/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationReadModel,
} from '../../services/policyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationContract.mjs';

const MARGIN_BAND_IDS = ['0_to_4', '5_to_14', '15_to_29', '30_or_more'];

function aggregateRows(count = 0) {
  return MARGIN_BAND_IDS.flatMap(score_margin_band_id => ([{
    score_margin_band_id,
    selection_status_id: 'confirmed_candidate',
    capture_count: count,
  }]));
}

describe('representative review-corpus capture evaluation contract', () => {
  test('rejects a missing automatic capture configuration', () => {
    expect(() => buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationReadModel())
      .toThrow('Automatic capture configuration is required.');
  });

  test('builds only fixed aggregate coverage and becomes human-evaluation ready per score margin band', () => {
    const result = buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationReadModel({
      configuration: { revision: 'not serialized' },
      aggregateRows: aggregateRows(6).map(row => ({ ...row, media_title: 'Do not serialize' })),
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: 'ready_for_human_evaluation',
      report: expect.objectContaining({ capturedOutcomeCount: 24, minimumCapturedOutcomeCount: 24 }),
    }));
    expect(result.report.scoreMarginCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({ scoreMarginBandId: '0_to_4', minimumSatisfied: true }),
    ]));
    expect(JSON.stringify(result)).not.toContain('not serialized');
    expect(JSON.stringify(result)).not.toContain('Do not serialize');
  });

  test('keeps collecting when any required score-margin band is underrepresented', () => {
    const result = buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationReadModel({
      configuration: { revision: 'not serialized' },
      aggregateRows: [
        { score_margin_band_id: '0_to_4', selection_status_id: 'confirmed_candidate', capture_count: 5 },
        { score_margin_band_id: '0_to_4', selection_status_id: 'changed_to_candidate', capture_count: 1 },
      ],
    });

    expect(result.statusId).toBe('collecting');
    expect(result.report.scoreMarginCoverage[0]).toEqual(expect.objectContaining({
      capturedOutcomeCount: 6,
      changedSelectionCount: 1,
      minimumSatisfied: true,
    }));
    expect(result.report.scoreMarginCoverage[1]).toEqual(expect.objectContaining({
      capturedOutcomeCount: 0,
      minimumSatisfied: false,
    }));
  });

  test('rejects a malformed or duplicate aggregate stratum instead of guessing', () => {
    expect(() => buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationReadModel({
      configuration: { revision: 'not serialized' },
      aggregateRows: [
        { score_margin_band_id: '0_to_4', selection_status_id: 'confirmed_candidate', capture_count: 1 },
        { score_margin_band_id: '0_to_4', selection_status_id: 'confirmed_candidate', capture_count: 1 },
      ],
    })).toThrow('Capture evaluation aggregate rows are invalid.');
  });
});
