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
  registerPendingQuestionCleanupInventoryRoute,
} from '../../routes/classificationRoutePendingCleanupInventory.mjs';

function createApp({ user = null, inventory = { mode: 'dry_run' } } = {}) {
  const inventoryService = { run: jest.fn().mockResolvedValue(inventory) };
  const app = express();
  const router = express.Router();

  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPendingQuestionCleanupInventoryRoute(router, {
    policyRuntimePendingQuestionCleanupInventoryService: inventoryService,
  });
  app.use('/api/classification', router);
  app.use(errorHandler);

  return { app, inventoryService };
}

describe('classificationRoutePendingCleanupInventory', () => {
  test('requires an authenticated administrator before it runs the inventory', async () => {
    const unauthenticated = createApp();
    const nonAdmin = createApp({ user: { id: 4, role: 'operator' } });

    const unauthenticatedResponse = await request(unauthenticated.app)
      .get('/api/classification/pending-cleanup/inventory');
    const nonAdminResponse = await request(nonAdmin.app)
      .get('/api/classification/pending-cleanup/inventory');

    expect(unauthenticatedResponse.status).toBe(401);
    expect(nonAdminResponse.status).toBe(403);
    expect(unauthenticated.inventoryService.run).not.toHaveBeenCalled();
    expect(nonAdmin.inventoryService.run).not.toHaveBeenCalled();
  });

  test('returns an uncached dry-run report without accepting caller supplied action state', async () => {
    const { app, inventoryService } = createApp({
      user: { id: 1, role: 'admin' },
      inventory: {
        mode: 'dry_run',
        records: [],
        sideEffects: { classificationRowsMutated: false },
      },
    });

    const response = await request(app)
      .get('/api/classification/pending-cleanup/inventory?action=apply&reason=client_supplied')
      .send({ action: 'apply', activeLibraryIds: [999] });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      mode: 'dry_run',
      records: [],
      sideEffects: { classificationRowsMutated: false },
    });
    expect(inventoryService.run).toHaveBeenCalledWith();
  });
});
