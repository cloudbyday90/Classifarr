/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportReadModel,
} from './policyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportContract.mjs';
import {
  createPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationService,
} from './policyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationService.mjs';

export class PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportValidationError extends Error {
  constructor(message = 'Future capture calibration report request is invalid.') {
    super(message);
    this.name = 'PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportValidationError';
    this.code = 'POLICY_CANDIDATE_CORRECTION_REVIEW_CORPUS_CAPTURE_CALIBRATION_REPORT_INVALID_REQUEST';
  }
}

function normalizeActorId(value) {
  const actorId = Number(value);
  return Number.isInteger(actorId) && actorId > 0 ? actorId : null;
}

/**
 * Reuses the aggregate-only capture evaluator rather than opening another
 * persistence path. This preserves its content-free boundary and guarantees
 * that calibration cannot read or retain individual reviewed outcomes.
 */
export function createPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportService({
  db,
  captureEvaluationService,
} = {}) {
  const evaluationService = captureEvaluationService ||
    createPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationService({ db });

  async function getCalibrationReport({ actorId } = {}) {
    const normalizedActorId = normalizeActorId(actorId);
    if (!normalizedActorId || typeof evaluationService?.getEvaluation !== 'function') {
      throw new PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportValidationError();
    }

    try {
      const captureEvaluation = await evaluationService.getEvaluation({ actorId: normalizedActorId });
      return buildPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportReadModel({
        captureEvaluation,
      });
    } catch (error) {
      throw new PolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportValidationError(
        error.message,
      );
    }
  }

  return Object.freeze({ getCalibrationReport });
}
