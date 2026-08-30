/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import { describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import {
  registerPolicyCandidateContrastiveOutcomeMetricsRoutes,
} from '../routes/statsRoutePolicyCandidateContrastiveOutcome.mjs';

describe('statsRoutePolicyCandidateContrastiveOutcome', () => {
  test('returns the authenticated aggregate without any identity dimensions', async () => {
    const getSummary = jest.fn().mockResolvedValue({
      version: 'policy.candidate_contrastive_outcome_metrics.v1',
      summary: { observationCount: 4 },
    });
    const app = express();
    const router = express.Router();
    registerPolicyCandidateContrastiveOutcomeMetricsRoutes(router, {
      db: { query: jest.fn() },
      createMetricsService: () => ({ getSummary }),
    });
    app.use('/api/stats', router);

    const response = await request(app)
      .get('/api/stats/policy-candidate-contrastive-outcomes?days=10')
      .expect(200);

    expect(response.body).toMatchObject({ summary: { observationCount: 4 } });
    expect(getSummary).toHaveBeenCalledWith({ windowDays: 10 });
    expect(JSON.stringify(response.body)).not.toContain('library_id');
  });

  test('bounds an invalid observation window before calling the service', async () => {
    const getSummary = jest.fn().mockResolvedValue({});
    const app = express();
    const router = express.Router();
    registerPolicyCandidateContrastiveOutcomeMetricsRoutes(router, {
      db: {},
      createMetricsService: () => ({ getSummary }),
    });
    app.use('/api/stats', router);

    await request(app)
      .get('/api/stats/policy-candidate-contrastive-outcomes?days=100')
      .expect(200);

    expect(getSummary).toHaveBeenCalledWith({ windowDays: 7 });
  });
});
