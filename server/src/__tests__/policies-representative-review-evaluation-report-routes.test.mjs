/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { errorHandler } from '../middleware/errorHandler.mjs';
import {
  registerPolicyCandidateCorrectionRepresentativeReviewEvaluationReportRoutes,
} from '../routes/policiesRouteRepresentativeReviewEvaluationReport.mjs';

function reportResponse() {
  return {
    version: 'policy.candidate_correction_representative_review_evaluation_report.v1',
    statusId: 'report_available',
    historicalRecordAccess: false,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    purposeId: 'representative_historical_correction_review',
    report: { itemCount: 1 },
  };
}

function createApp({ user = { id: 7, role: 'admin' } } = {}) {
  const evaluationReportService = { getEvaluationReport: jest.fn().mockResolvedValue(reportResponse()) };
  const rateLimit = jest.fn(() => (_req, _res, next) => next());
  const app = express();
  const router = express.Router();
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyCandidateCorrectionRepresentativeReviewEvaluationReportRoutes(router, {
    db: {},
    logger: { info: jest.fn() },
    rateLimit,
    evaluationReportService,
  });
  app.use('/api/policies', router);
  app.use(errorHandler);
  return { app, evaluationReportService, rateLimit };
}

describe('representative review evaluation-report routes', () => {
  test('requires an administrator and sends a no-store aggregate response', async () => {
    const { app, evaluationReportService, rateLimit } = createApp();
    const response = await request(app)
      .get('/api/policies/candidate-correction/review-corpus/evaluation-report')
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual(expect.objectContaining({
      historicalRecordAccess: false,
      automaticPolicyChange: false,
    }));
    expect(evaluationReportService.getEvaluationReport).toHaveBeenCalledWith({ actorId: 7 });
    expect(rateLimit).toHaveBeenCalledTimes(1);

    await request(createApp({ user: { id: 8, role: 'operator' } }).app)
      .get('/api/policies/candidate-correction/review-corpus/evaluation-report')
      .expect(403);
  });
});
