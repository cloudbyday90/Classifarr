/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { policyCandidateCorrectionReviewCorpusControlLimiterConfig } from '../config/rateLimits.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import {
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  PolicyCandidateCorrectionRepresentativeReviewCorpusControlConflictError,
  PolicyCandidateCorrectionRepresentativeReviewCorpusControlValidationError,
  createPolicyCandidateCorrectionRepresentativeReviewCorpusControlService,
} from '../services/policyCandidateCorrectionRepresentativeReviewCorpusControlService.mjs';

function requireReviewCorpusControlAdministrator(req) {
  const actorId = Number(req.user?.id);
  if (req.user?.role !== 'admin' || !Number.isInteger(actorId) || actorId <= 0) {
    throw new ForbiddenError('Admin access required');
  }

  return actorId;
}

function preventReviewCorpusControlResponseCaching(res) {
  res.set('Cache-Control', 'no-store');
}

function createReviewCorpusControlLimiter(rateLimit) {
  return typeof rateLimit === 'function'
    ? rateLimit(policyCandidateCorrectionReviewCorpusControlLimiterConfig)
    : (_req, _res, next) => next();
}

function mapReviewCorpusControlError(error) {
  if (error instanceof PolicyCandidateCorrectionRepresentativeReviewCorpusControlValidationError) {
    return new ValidationError(error.message, { code: error.code });
  }

  if (error instanceof PolicyCandidateCorrectionRepresentativeReviewCorpusControlConflictError) {
    return new ConflictError(error.message, { code: error.code });
  }

  return error;
}

export function registerPolicyCandidateCorrectionRepresentativeReviewCorpusControlRoutes(router, {
  db,
  logger,
  rateLimit,
  controlService = createPolicyCandidateCorrectionRepresentativeReviewCorpusControlService({ db }),
} = {}) {
  const configurationWriteLimiter = createReviewCorpusControlLimiter(rateLimit);

  router.get('/candidate-correction/review-corpus/configuration', asyncHandler(async (req, res) => {
    requireReviewCorpusControlAdministrator(req);
    const result = await controlService.getConfiguration();
    preventReviewCorpusControlResponseCaching(res);
    return sendData(res, result);
  }));

  router.get('/candidate-correction/review-corpus/audit-events', asyncHandler(async (req, res) => {
    requireReviewCorpusControlAdministrator(req);
    const result = await controlService.getRecentAuditEvents({ limit: req.query?.limit });
    preventReviewCorpusControlResponseCaching(res);
    return sendData(res, result);
  }));

  router.put('/candidate-correction/review-corpus/configuration', configurationWriteLimiter, asyncHandler(async (req, res) => {
    const actorId = requireReviewCorpusControlAdministrator(req);
    try {
      const result = await controlService.acknowledgeConfiguration({
        actorId,
        request: req.body,
      });
      logger?.info('Representative review-corpus safeguards acknowledged', {
        actorId,
        statusId: result.statusId,
        operationId: result.operationId,
      });
      preventReviewCorpusControlResponseCaching(res);
      return sendData(res, result, result.operationId === 'configuration_acknowledged' ? 201 : 200);
    } catch (error) {
      throw mapReviewCorpusControlError(error);
    }
  }));
}

export {
  createReviewCorpusControlLimiter,
  preventReviewCorpusControlResponseCaching,
  requireReviewCorpusControlAdministrator,
};
