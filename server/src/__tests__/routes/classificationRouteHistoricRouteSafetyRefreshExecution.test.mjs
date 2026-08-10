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
import { jest } from '@jest/globals';
import request from 'supertest';

import { errorHandler } from '../../middleware/errorHandler.mjs';
import {
  registerHistoricRouteSafetyRefreshExecutionRoute,
} from '../../routes/classificationRouteHistoricRouteSafetyRefreshExecution.mjs';

function createApp({
  user = null,
  executionResult = { mode: 'apply', records: [] },
  requireReadWrite: providedRequireReadWrite = null,
} = {}) {
  const executionService = { run: jest.fn().mockResolvedValue(executionResult) };
  const requireReadWrite = providedRequireReadWrite || jest.fn((_req, _res, next) => next());
  const app = express();
  const router = express.Router();

  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerHistoricRouteSafetyRefreshExecutionRoute(router, {
    policyRuntimeHistoricRouteSafetyRefreshExecutionService: executionService,
    requireReadWrite,
  });
  app.use('/api/classification', router);
  app.use(errorHandler);

  return { app, executionService, requireReadWrite };
}

describe('classificationRouteHistoricRouteSafetyRefreshExecution', () => {
  test('requires an authenticated administrator and read-write authorization', async () => {
    const unauthenticated = createApp();
    const nonAdmin = createApp({ user: { id: 4, role: 'operator' } });

    expect((await request(unauthenticated.app)
      .post('/api/classification/pending/route-safety-refresh/retry')
      .send({ classificationIds: [4] })).status).toBe(401);
    expect((await request(nonAdmin.app)
      .post('/api/classification/pending/route-safety-refresh/retry')
      .send({ classificationIds: [4] })).status).toBe(403);
    expect(unauthenticated.executionService.run).not.toHaveBeenCalled();
    expect(nonAdmin.executionService.run).not.toHaveBeenCalled();
    expect(unauthenticated.requireReadWrite).not.toHaveBeenCalled();
    expect(nonAdmin.requireReadWrite).not.toHaveBeenCalled();
  });

  test('accepts only selected IDs, derives the actor server-side, and returns no-store', async () => {
    const { app, executionService, requireReadWrite } = createApp({
      user: { id: 'admin-4', role: 'admin' },
      executionResult: { mode: 'apply', retryReceipt: 'receipt', records: [{ classificationId: 4 }] },
    });

    const response = await request(app)
      .post('/api/classification/pending/route-safety-refresh/retry')
      .send({ classificationIds: [4] });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ mode: 'apply', retryReceipt: 'receipt', records: [{ classificationId: 4 }] });
    expect(requireReadWrite).toHaveBeenCalledTimes(1);
    expect(executionService.run).toHaveBeenCalledWith({
      classificationIds: [4],
      actorId: 'user:admin-4',
    });
  });

  test('rejects caller-supplied actor, source, and eligibility authority', async () => {
    const { app, executionService } = createApp({ user: { id: 1, role: 'admin' } });

    const response = await request(app)
      .post('/api/classification/pending/route-safety-refresh/retry')
      .send({
        classificationIds: [4],
        actorId: 'attacker',
        taskSource: 'manual_retry',
      });

    expect(response.status).toBe(400);
    expect(executionService.run).not.toHaveBeenCalled();
  });
});
