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
  registerPendingQuestionCleanupApplyRoute,
} from '../../routes/classificationRoutePendingCleanupApply.mjs';

function createApp({ user = null, applyResult = { mode: 'apply', records: [] } } = {}) {
  const applyService = { run: jest.fn().mockResolvedValue(applyResult) };
  const requireReadWrite = jest.fn((_req, _res, next) => next());
  const app = express();
  const router = express.Router();

  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPendingQuestionCleanupApplyRoute(router, {
    policyRuntimePendingQuestionCleanupApplyService: applyService,
    requireReadWrite,
  });
  app.use('/api/classification', router);
  app.use(errorHandler);

  return { app, applyService, requireReadWrite };
}

describe('classificationRoutePendingCleanupApply', () => {
  test('requires an authenticated administrator and read-write authorization before applying cleanup', async () => {
    const unauthenticated = createApp();
    const nonAdmin = createApp({ user: { id: 9, role: 'operator' } });

    expect((await request(unauthenticated.app)
      .post('/api/classification/pending-cleanup/apply')
      .send({ classificationIds: [4] })).status).toBe(401);
    expect((await request(nonAdmin.app)
      .post('/api/classification/pending-cleanup/apply')
      .send({ classificationIds: [4] })).status).toBe(403);
    expect(unauthenticated.applyService.run).not.toHaveBeenCalled();
    expect(nonAdmin.applyService.run).not.toHaveBeenCalled();
    expect(unauthenticated.requireReadWrite).not.toHaveBeenCalled();
    expect(nonAdmin.requireReadWrite).not.toHaveBeenCalled();
  });

  test('accepts only selected IDs, derives a server actor, and does not cache the result', async () => {
    const { app, applyService, requireReadWrite } = createApp({
      user: { id: 'a-17', role: 'admin' },
      applyResult: { mode: 'apply', records: [{ classificationId: 4 }] },
    });

    const response = await request(app)
      .post('/api/classification/pending-cleanup/apply')
      .send({ classificationIds: [4] });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ mode: 'apply', records: [{ classificationId: 4 }] });
    expect(requireReadWrite).toHaveBeenCalledTimes(1);
    expect(applyService.run).toHaveBeenCalledWith({
      classificationIds: [4],
      actorId: 'user:a-17',
    });
  });

  test('rejects caller-supplied cleanup actions and leaves the apply service untouched', async () => {
    const { app, applyService } = createApp({ user: { id: 1, role: 'admin' } });

    const response = await request(app)
      .post('/api/classification/pending-cleanup/apply')
      .send({ classificationIds: [4], action: 'resolve_outcome_only' });

    expect(response.status).toBe(400);
    expect(applyService.run).not.toHaveBeenCalled();
  });
});
