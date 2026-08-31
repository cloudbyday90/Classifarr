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
  buildPolicyCandidateCorrectionRepresentativeReviewEvaluationReportReadModel,
} from './policyCandidateCorrectionRepresentativeReviewEvaluationReportContract.mjs';
import {
  createPolicyCandidateCorrectionRepresentativeReviewProjectionService,
} from './policyCandidateCorrectionRepresentativeReviewProjectionService.mjs';

export class PolicyCandidateCorrectionRepresentativeReviewEvaluationReportValidationError extends Error {
  constructor(message = 'Evaluation report request is invalid.') {
    super(message);
    this.name = 'PolicyCandidateCorrectionRepresentativeReviewEvaluationReportValidationError';
    this.code = 'POLICY_CANDIDATE_CORRECTION_REVIEW_EVALUATION_REPORT_INVALID_REQUEST';
  }
}

function normalizeActorId(value) {
  const actorId = Number(value);
  return Number.isInteger(actorId) && actorId > 0 ? actorId : null;
}

/**
 * Builds a fresh report from the existing active redacted projection. This
 * service owns no history query or persistence path, which keeps the report
 * bounded to the same data-minimization contract as the projection itself.
 */
export function createPolicyCandidateCorrectionRepresentativeReviewEvaluationReportService({
  projectionService = createPolicyCandidateCorrectionRepresentativeReviewProjectionService(),
} = {}) {
  async function getEvaluationReport({ actorId } = {}) {
    const normalizedActorId = normalizeActorId(actorId);
    if (!normalizedActorId || typeof projectionService?.getProjection !== 'function') {
      throw new PolicyCandidateCorrectionRepresentativeReviewEvaluationReportValidationError();
    }

    const projectionReadModel = await projectionService.getProjection({
      actorId: normalizedActorId,
      auditProjectionView: false,
    });
    try {
      return buildPolicyCandidateCorrectionRepresentativeReviewEvaluationReportReadModel({ projectionReadModel });
    } catch (error) {
      throw new PolicyCandidateCorrectionRepresentativeReviewEvaluationReportValidationError(error.message);
    }
  }

  return Object.freeze({ getEvaluationReport });
}
