/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import { describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import {
  registerCandidateBoundVerificationMetricsRoutes,
} from '../routes/statsRouteCandidateBoundVerification.mjs';

describe('statsRouteCandidateBoundVerification', () => {
  test('returns the bounded, read-only aggregate report', async () => {
    const getSummary = jest.fn().mockResolvedValue({
      version: 'classification.candidate_bound_verification_metrics.v1',
      driftGuard: { statusId: 'stable' },
    });
    const createMetricsService = jest.fn().mockReturnValue({ getSummary });
    const app = express();
    const router = express.Router();
    registerCandidateBoundVerificationMetricsRoutes(router, {
      db: { query: jest.fn() },
      createMetricsService,
    });
    app.use('/api/stats', router);

    const response = await request(app)
      .get('/api/stats/candidate-bound-verification?days=10')
      .expect(200);

    expect(response.body).toMatchObject({ driftGuard: { statusId: 'stable' } });
    expect(getSummary).toHaveBeenCalledWith({ windowDays: 10 });
  });

  test('falls back to the bounded default for invalid or excessive windows', async () => {
    const getSummary = jest.fn().mockResolvedValue({});
    const app = express();
    const router = express.Router();
    registerCandidateBoundVerificationMetricsRoutes(router, {
      db: {},
      createMetricsService: () => ({ getSummary }),
    });
    app.use('/api/stats', router);

    await request(app)
      .get('/api/stats/candidate-bound-verification?days=100')
      .expect(200);

    expect(getSummary).toHaveBeenCalledWith({ windowDays: 7 });
  });
});
