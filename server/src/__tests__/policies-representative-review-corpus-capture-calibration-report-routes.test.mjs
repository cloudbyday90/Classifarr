/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import request from 'supertest';
import { describe, expect, jest, test } from '@jest/globals';
import { errorHandler } from '../middleware/errorHandler.mjs';
import {
  registerPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportRoutes,
} from '../routes/policiesRouteRepresentativeReviewCorpusCaptureCalibrationReport.mjs';

function reportResponse() {
  return {
    version: 'policy.candidate_correction_representative_review_corpus_capture_calibration_report.v1',
    statusId: 'report_available',
    report: { recommendation: { recommendationId: 'continue_observing', reviewBandIds: [] } },
  };
}

function createApp({ user = { id: 7, role: 'admin' } } = {}) {
  const calibrationReportService = { getCalibrationReport: jest.fn().mockResolvedValue(reportResponse()) };
  const rateLimit = jest.fn(() => (_req, _res, next) => next());
  const app = express();
  const router = express.Router();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureCalibrationReportRoutes(router, {
    db: {},
    logger: { info: jest.fn() },
    rateLimit,
    calibrationReportService,
  });
  app.use('/api/policies', router);
  app.use(errorHandler);
  return { app, calibrationReportService, rateLimit };
}

describe('representative review-corpus future-capture calibration report routes', () => {
  test('requires an administrator and returns one no-store aggregate report', async () => {
    const { app, calibrationReportService, rateLimit } = createApp();
    const response = await request(app)
      .get('/api/policies/candidate-correction/review-corpus/captured-outcomes/calibration-report')
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(calibrationReportService.getCalibrationReport).toHaveBeenCalledWith({ actorId: 7 });
    expect(rateLimit).toHaveBeenCalledTimes(1);
    await request(createApp({ user: { id: 8, role: 'operator' } }).app)
      .get('/api/policies/candidate-correction/review-corpus/captured-outcomes/calibration-report')
      .expect(403);
  });

  test('rejects caller-selected query or body selectors', async () => {
    const { app, calibrationReportService } = createApp();
    await request(app)
      .get('/api/policies/candidate-correction/review-corpus/captured-outcomes/calibration-report?limit=1')
      .expect(400);
    await request(app)
      .get('/api/policies/candidate-correction/review-corpus/captured-outcomes/calibration-report')
      .send({ actorId: 9 })
      .expect(400);
    expect(calibrationReportService.getCalibrationReport).not.toHaveBeenCalled();
  });
});
