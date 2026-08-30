/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import { describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import {
  registerPolicyCandidateCorrectionAnalyticsMetricsRoutes,
} from '../routes/statsRoutePolicyCandidateCorrectionAnalytics.mjs';

describe('statsRoutePolicyCandidateCorrectionAnalytics', () => {
  test('returns the authenticated aggregate without identity dimensions', async () => {
    const getSummary = jest.fn().mockResolvedValue({
      version: 'policy.candidate_correction_analytics_metrics.v2',
      summary: { outcomeCount: 4 },
    });
    const app = express();
    const router = express.Router();
    registerPolicyCandidateCorrectionAnalyticsMetricsRoutes(router, {
      db: { query: jest.fn() },
      createMetricsService: () => ({ getSummary }),
    });
    app.use('/api/stats', router);

    const response = await request(app)
      .get('/api/stats/policy-candidate-correction-analytics?days=10')
      .expect(200);

    expect(response.body).toMatchObject({ summary: { outcomeCount: 4 } });
    expect(getSummary).toHaveBeenCalledWith({ windowDays: 10 });
    expect(JSON.stringify(response.body)).not.toContain('library_id');
  });

  test('bounds an invalid observation window before calling the service', async () => {
    const getSummary = jest.fn().mockResolvedValue({});
    const app = express();
    const router = express.Router();
    registerPolicyCandidateCorrectionAnalyticsMetricsRoutes(router, {
      db: {},
      createMetricsService: () => ({ getSummary }),
    });
    app.use('/api/stats', router);

    await request(app)
      .get('/api/stats/policy-candidate-correction-analytics?days=100')
      .expect(200);

    expect(getSummary).toHaveBeenCalledWith({ windowDays: 7 });
  });
});
