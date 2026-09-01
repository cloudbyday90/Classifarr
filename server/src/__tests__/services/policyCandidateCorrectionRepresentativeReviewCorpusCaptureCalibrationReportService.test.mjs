/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportValidationError,
  createPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportService,
} from '../../services/policyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportService.mjs';
import {
  buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationReadModel,
} from '../../services/policyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationContract.mjs';

function captureEvaluation() {
  return buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationReadModel({
    configuration: { revision: 'not serialized' },
    aggregateRows: ['0_to_4', '5_to_14', '15_to_29', '30_or_more'].map(score_margin_band_id => ({
      score_margin_band_id,
      selection_status_id: 'confirmed_candidate',
      capture_count: 6,
    })),
  });
}

describe('representative review-corpus future-capture calibration report service', () => {
  test('delegates to the existing aggregate evaluator and does not create another persistence path', async () => {
    const captureEvaluationService = { getEvaluation: jest.fn().mockResolvedValue(captureEvaluation()) };
    const service = createPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportService({
      captureEvaluationService,
    });

    await expect(service.getCalibrationReport({ actorId: 7 })).resolves.toMatchObject({
      statusId: 'report_available',
      report: { capturedOutcomeCount: 24 },
    });
    expect(captureEvaluationService.getEvaluation).toHaveBeenCalledWith({ actorId: 7 });
  });

  test('fails closed for invalid actors and malformed evaluator output', async () => {
    const invalidActorService = createPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportService({
      captureEvaluationService: { getEvaluation: jest.fn() },
    });
    await expect(invalidActorService.getCalibrationReport({ actorId: 0 }))
      .rejects.toBeInstanceOf(PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportValidationError);

    const malformedService = createPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportService({
      captureEvaluationService: { getEvaluation: jest.fn().mockResolvedValue({}) },
    });
    await expect(malformedService.getCalibrationReport({ actorId: 7 }))
      .rejects.toBeInstanceOf(PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportValidationError);
  });
});
