/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';
import {
  buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportReadModel,
} from '../../services/policyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportContract.mjs';
import {
  buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationReadModel,
} from '../../services/policyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationContract.mjs';

const MARGIN_BAND_IDS = ['0_to_4', '5_to_14', '15_to_29', '30_or_more'];

function captureEvaluation(countsByBand = {}) {
  return buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationReadModel({
    configuration: { revision: 'not serialized' },
    aggregateRows: MARGIN_BAND_IDS.flatMap(score_margin_band_id => (
      Object.entries(countsByBand[score_margin_band_id] || {}).map(([selection_status_id, capture_count]) => ({
        score_margin_band_id,
        selection_status_id,
        capture_count,
        media_title: 'must not cross the calibration boundary',
      }))
    )),
  });
}

describe('representative review-corpus future-capture calibration report contract', () => {
  test('keeps collecting until the fixed aggregate baseline is ready', () => {
    const result = buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportReadModel({
      captureEvaluation: captureEvaluation({
        '0_to_4': { confirmed_candidate: 6 },
      }),
    });

    expect(result).toMatchObject({ statusId: 'collecting', report: null });
    expect(result.authority.automaticActions).toEqual({
      aiInvocation: false,
      learning: false,
      policyChange: false,
      ragTuning: false,
      retry: false,
      routing: false,
    });
  });

  test('identifies a statistically bounded close-candidate review prompt without leaking source content', () => {
    const result = buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportReadModel({
      captureEvaluation: captureEvaluation({
        '0_to_4': { confirmed_candidate: 10, changed_to_candidate: 10 },
        '5_to_14': { confirmed_candidate: 20 },
        '15_to_29': { confirmed_candidate: 20 },
        '30_or_more': { confirmed_candidate: 20 },
      }),
    });

    expect(result).toMatchObject({
      statusId: 'report_available',
      report: {
        capturedOutcomeCount: 80,
        recommendation: {
          recommendationId: 'review_close_candidate_boundaries',
          reviewBandIds: ['0_to_4'],
        },
      },
    });
    expect(result.report.scoreMarginBands[0]).toMatchObject({
      scoreMarginBandId: '0_to_4',
      confirmationRatePercent: 50,
      calibrationReadiness: {
        statusId: 'review_recommended',
        changedSelectionConfidenceInterval: {
          methodId: 'wilson_score',
          confidenceLevelPercent: 95,
          lowerRatePercent: 29.9,
          upperRatePercent: 70.1,
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('must not cross the calibration boundary');
    expect(JSON.stringify(result)).not.toContain('media_title');
  });

  test('rejects a capture evaluation that grants routing authority', () => {
    const capture = structuredClone(captureEvaluation({
      '0_to_4': { confirmed_candidate: 6 },
      '5_to_14': { confirmed_candidate: 6 },
      '15_to_29': { confirmed_candidate: 6 },
      '30_or_more': { confirmed_candidate: 6 },
    }));
    capture.authority.automaticActions.routing = true;

    expect(() => buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportReadModel({
      captureEvaluation: capture,
    })).toThrow('Future capture evaluation read model is invalid.');
  });
});
