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
  registerHistoricRouteSafetyRefreshInventoryRoute,
} from '../../routes/classificationRouteHistoricRouteSafetyRefreshInventory.mjs';

function createApp({ user = null, inventory = { mode: 'read_only', records: [] } } = {}) {
  const inventoryService = { run: jest.fn().mockResolvedValue(inventory) };
  const app = express();
  const router = express.Router();

  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerHistoricRouteSafetyRefreshInventoryRoute(router, {
    policyRuntimeHistoricRouteSafetyRefreshInventoryService: inventoryService,
  });
  app.use('/api/classification', router);
  app.use(errorHandler);

  return { app, inventoryService };
}

describe('classificationRouteHistoricRouteSafetyRefreshInventory', () => {
  test('requires an authenticated administrator before reading the inventory', async () => {
    const unauthenticated = createApp();
    const nonAdmin = createApp({ user: { id: 4, role: 'operator' } });

    expect((await request(unauthenticated.app)
      .get('/api/classification/pending/route-safety-refresh-inventory')).status).toBe(401);
    expect((await request(nonAdmin.app)
      .get('/api/classification/pending/route-safety-refresh-inventory')).status).toBe(403);
    expect(unauthenticated.inventoryService.run).not.toHaveBeenCalled();
    expect(nonAdmin.inventoryService.run).not.toHaveBeenCalled();
  });

  test('returns an uncached read-only report and forwards only bounded pagination inputs', async () => {
    const { app, inventoryService } = createApp({
      user: { id: 1, role: 'admin' },
      inventory: {
        mode: 'read_only',
        records: [],
        sideEffects: { classificationRowsMutated: false },
      },
    });

    const response = await request(app)
      .get('/api/classification/pending/route-safety-refresh-inventory?cursor=41&limit=999&action=retry')
      .send({ classificationIds: [41] });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      mode: 'read_only',
      records: [],
      sideEffects: { classificationRowsMutated: false },
    });
    expect(inventoryService.run).toHaveBeenCalledWith({ cursor: 41, limit: 50 });
  });
});
