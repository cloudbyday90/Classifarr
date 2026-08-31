/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { errorHandler } from '../middleware/errorHandler.mjs';
import {
  registerPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryRoutes,
} from '../routes/policiesRoutePolicyChangeReviewHistorySummary.mjs';

function response() {
  return {
    version: 'policy.candidate_correction_policy_change_review_history_summary.v1',
    statusId: 'collecting',
    historyAvailable: false,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    routingChanged: false,
    periods: [],
  };
}

function createApp({ user = { id: 7, role: 'admin' } } = {}) {
  const reviewHistorySummaryService = {
    getReviewHistorySummary: jest.fn().mockResolvedValue(response()),
  };
  const rateLimit = jest.fn(() => (_req, _res, next) => next());
  const app = express();
  const router = express.Router();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryRoutes(router, {
    db: {},
    rateLimit,
    reviewHistorySummaryService,
  });
  app.use('/api/policies', router);
  app.use(errorHandler);
  return { app, reviewHistorySummaryService, rateLimit };
}

describe('policy-change review history summary routes', () => {
  test('requires an administrator and returns a no-store selector-free summary', async () => {
    const { app, reviewHistorySummaryService, rateLimit } = createApp();
    const result = await request(app)
      .get('/api/policies/candidate-correction/policy-change-review-history-summary')
      .expect(200);

    expect(result.headers['cache-control']).toBe('no-store');
    expect(reviewHistorySummaryService.getReviewHistorySummary).toHaveBeenCalledWith({ actorId: 7 });
    expect(rateLimit).toHaveBeenCalledTimes(1);

    await request(createApp({ user: { id: 8, role: 'operator' } }).app)
      .get('/api/policies/candidate-correction/policy-change-review-history-summary')
      .expect(403);
  });

  test('rejects browser-selected dimensions, query ranges, and bodies', async () => {
    const { app, reviewHistorySummaryService } = createApp();

    await request(app)
      .get('/api/policies/candidate-correction/policy-change-review-history-summary?period=2026-08-01')
      .expect(400);
    await request(app)
      .get('/api/policies/candidate-correction/policy-change-review-history-summary')
      .send({ policy_id: 1 })
      .expect(400);
    expect(reviewHistorySummaryService.getReviewHistorySummary).not.toHaveBeenCalled();
  });
});
