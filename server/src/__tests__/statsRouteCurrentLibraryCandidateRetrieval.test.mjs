/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import { describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import {
  registerCurrentLibraryCandidateRetrievalMetricsRoutes,
} from '../routes/statsRouteCurrentLibraryCandidateRetrieval.mjs';

describe('statsRouteCurrentLibraryCandidateRetrieval', () => {
  test('returns the authenticated router aggregate without item dimensions', async () => {
    const getSummary = jest.fn().mockResolvedValue({
      version: 'current_library.candidate_retrieval_metrics.v1',
      retrieval: { observationCount: 4 },
    });
    const app = express();
    const router = express.Router();
    registerCurrentLibraryCandidateRetrievalMetricsRoutes(router, {
      db: { query: jest.fn() },
      createMetricsService: () => ({ getSummary }),
    });
    app.use('/api/stats', router);

    const response = await request(app)
      .get('/api/stats/current-library-candidate-retrieval?days=10')
      .expect(200);

    expect(response.body).toMatchObject({ retrieval: { observationCount: 4 } });
    expect(getSummary).toHaveBeenCalledWith({ windowDays: 10 });
  });

  test('bounds invalid windows before calling the service', async () => {
    const getSummary = jest.fn().mockResolvedValue({});
    const app = express();
    const router = express.Router();
    registerCurrentLibraryCandidateRetrievalMetricsRoutes(router, {
      db: {},
      createMetricsService: () => ({ getSummary }),
    });
    app.use('/api/stats', router);

    await request(app)
      .get('/api/stats/current-library-candidate-retrieval?days=100')
      .expect(200);

    expect(getSummary).toHaveBeenCalledWith({ windowDays: 7 });
  });
});
