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
  registerPolicyCandidateCorrectionRepresentativeReviewProjectionRoutes,
} from '../routes/policiesRouteRepresentativeReviewProjection.mjs';

function projectionResponse({ operationId } = {}) {
  return {
    version: 'policy.candidate_correction_representative_review_projection.v1',
    statusId: 'projection_available',
    historicalRecordAccess: false,
    purposeId: 'representative_historical_correction_review',
    projection: { itemCount: 1 },
    ...(operationId ? { operationId } : {}),
  };
}

function createApp({ user = { id: 7, role: 'admin' } } = {}) {
  const projectionService = {
    getProjection: jest.fn().mockResolvedValue(projectionResponse()),
    createProjection: jest.fn().mockResolvedValue(projectionResponse({ operationId: 'projection_created' })),
  };
  const rateLimit = jest.fn(() => (_req, _res, next) => next());
  const app = express();
  const router = express.Router();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyCandidateCorrectionRepresentativeReviewProjectionRoutes(router, {
    db: {},
    logger: { info: jest.fn() },
    rateLimit,
    projectionService,
  });
  app.use('/api/policies', router);
  app.use(errorHandler);
  return { app, projectionService, rateLimit };
}

describe('representative review projection routes', () => {
  test('requires an administrator, records the actor boundary, and prevents caching', async () => {
    const { app, projectionService, rateLimit } = createApp();
    const response = await request(app)
      .get('/api/policies/candidate-correction/review-corpus/projection')
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual(expect.objectContaining({ historicalRecordAccess: false }));
    expect(projectionService.getProjection).toHaveBeenCalledWith({ actorId: 7 });
    expect(rateLimit).toHaveBeenCalledTimes(2);

    await request(createApp({ user: { id: 8, role: 'operator' } }).app)
      .get('/api/policies/candidate-correction/review-corpus/projection')
      .expect(403);
  });

  test('creates only through the server-owned projection operation and reports creation', async () => {
    const { app, projectionService } = createApp();
    const response = await request(app)
      .post('/api/policies/candidate-correction/review-corpus/projection')
      .send({ title: 'ignored by route; service has no request payload' })
      .expect(201);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(projectionService.createProjection).toHaveBeenCalledWith({ actorId: 7 });
  });
});
