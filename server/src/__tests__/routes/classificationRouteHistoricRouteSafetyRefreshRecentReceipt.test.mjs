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
  registerHistoricRouteSafetyRefreshRecentReceiptRoute,
} from '../../routes/classificationRouteHistoricRouteSafetyRefreshRecentReceipt.mjs';

const RECEIPT_ID = '4b8d027d-8daf-4186-a9f8-89df6f69c95e';

function createApp({ user = null, report = { mode: 'read_only', recentReceipt: null } } = {}) {
  const discoveryService = { run: jest.fn().mockResolvedValue(report) };
  const app = express();
  const router = express.Router();

  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerHistoricRouteSafetyRefreshRecentReceiptRoute(router, {
    policyRuntimeHistoricRouteSafetyRefreshRecentReceiptDiscoveryService: discoveryService,
  });
  app.use('/api/classification', router);
  app.use(errorHandler);

  return { app, discoveryService };
}

describe('classificationRouteHistoricRouteSafetyRefreshRecentReceipt', () => {
  test('requires an authenticated administrator before discovery', async () => {
    const unauthenticated = createApp();
    const nonAdmin = createApp({ user: { id: 4, role: 'operator' } });

    expect((await request(unauthenticated.app)
      .get('/api/classification/pending/route-safety-refresh/receipts/recent')).status).toBe(401);
    expect((await request(nonAdmin.app)
      .get('/api/classification/pending/route-safety-refresh/receipts/recent')).status).toBe(403);
    expect(unauthenticated.discoveryService.run).not.toHaveBeenCalled();
    expect(nonAdmin.discoveryService.run).not.toHaveBeenCalled();
  });

  test('returns one uncached, actor-derived receipt reference without write authorization', async () => {
    const { app, discoveryService } = createApp({
      user: { id: 1, role: 'admin' },
      report: { mode: 'read_only', recentReceipt: { retryReceipt: RECEIPT_ID } },
    });

    const response = await request(app)
      .get('/api/classification/pending/route-safety-refresh/receipts/recent');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ mode: 'read_only', recentReceipt: { retryReceipt: RECEIPT_ID } });
    expect(discoveryService.run).toHaveBeenCalledWith({ actorId: 'user:1' });
  });

  test('fails closed when an admin role lacks a stable actor identity', async () => {
    const { app, discoveryService } = createApp({ user: { role: 'admin' } });

    const response = await request(app)
      .get('/api/classification/pending/route-safety-refresh/receipts/recent');

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('historic_route_safety_refresh_actor_identity_required');
    expect(discoveryService.run).not.toHaveBeenCalled();
  });
});
