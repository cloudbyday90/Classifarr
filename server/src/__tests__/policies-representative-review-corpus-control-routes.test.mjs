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
  registerPolicyCandidateCorrectionRepresentativeReviewCorpusControlRoutes,
} from '../routes/policiesRouteRepresentativeReviewCorpusControl.mjs';

const SAFEGUARDS = ['authorization', 'redaction', 'retention', 'operator_audit'];

function createApp({ user = { id: 7, role: 'admin' } } = {}) {
  const controlService = {
    getConfiguration: jest.fn().mockResolvedValue({
      statusId: 'configuration_required',
      historicalRecordAccess: false,
      configuration: null,
    }),
    getRecentAuditEvents: jest.fn().mockResolvedValue({ version: 'v1', events: [] }),
    acknowledgeConfiguration: jest.fn().mockResolvedValue({
      statusId: 'configuration_acknowledged',
      operationId: 'configuration_acknowledged',
      historicalRecordAccess: false,
    }),
  };
  const rateLimit = jest.fn(() => (_req, _res, next) => next());
  const app = express();
  const router = express.Router();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyCandidateCorrectionRepresentativeReviewCorpusControlRoutes(router, {
    db: {},
    logger: { info: jest.fn() },
    rateLimit,
    controlService,
  });
  app.use('/api/policies', router);
  app.use(errorHandler);
  return { app, controlService, rateLimit };
}

describe('representative review-corpus control routes', () => {
  test('requires an administrator and prevents configuration response caching', async () => {
    const { app, controlService } = createApp();
    const response = await request(app)
      .get('/api/policies/candidate-correction/review-corpus/configuration')
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual(expect.objectContaining({ historicalRecordAccess: false }));

    await request(createApp({ user: { id: 8, role: 'operator' } }).app)
      .get('/api/policies/candidate-correction/review-corpus/configuration')
      .expect(403);
    expect(controlService.getConfiguration).toHaveBeenCalledTimes(1);
  });

  test('forwards only the bounded acknowledgement request and reports a created audit event', async () => {
    const { app, controlService, rateLimit } = createApp();
    const response = await request(app)
      .put('/api/policies/candidate-correction/review-corpus/configuration')
      .send({
        expected_revision: null,
        acknowledged_safeguard_ids: SAFEGUARDS,
        review_record_retention_days: 30,
      })
      .expect(201);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(rateLimit).toHaveBeenCalledTimes(1);
    expect(controlService.acknowledgeConfiguration).toHaveBeenCalledWith({
      actorId: 7,
      request: {
        expected_revision: null,
        acknowledged_safeguard_ids: SAFEGUARDS,
        review_record_retention_days: 30,
      },
    });
  });

  test('passes the bounded audit limit to the control service', async () => {
    const { app, controlService } = createApp();
    await request(app)
      .get('/api/policies/candidate-correction/review-corpus/audit-events?limit=5')
      .expect(200);

    expect(controlService.getRecentAuditEvents).toHaveBeenCalledWith({ limit: '5' });
  });
});
