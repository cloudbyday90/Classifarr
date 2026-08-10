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
  registerHistoricRouteSafetyRefreshReceiptRoute,
} from '../../routes/classificationRouteHistoricRouteSafetyRefreshReceipt.mjs';

const RECEIPT_ID = '4b8d027d-8daf-4186-a9f8-89df6f69c95e';

function createApp({ user = null, report = { mode: 'read_only', records: [] } } = {}) {
  const reconciliationService = { run: jest.fn().mockResolvedValue(report) };
  const app = express();
  const router = express.Router();

  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerHistoricRouteSafetyRefreshReceiptRoute(router, {
    policyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService: reconciliationService,
  });
  app.use('/api/classification', router);
  app.use(errorHandler);

  return { app, reconciliationService };
}

describe('classificationRouteHistoricRouteSafetyRefreshReceipt', () => {
  test('requires an authenticated administrator before reading a receipt', async () => {
    const unauthenticated = createApp();
    const nonAdmin = createApp({ user: { id: 4, role: 'operator' } });

    expect((await request(unauthenticated.app)
      .get(`/api/classification/pending/route-safety-refresh/receipts/${RECEIPT_ID}`)).status).toBe(401);
    expect((await request(nonAdmin.app)
      .get(`/api/classification/pending/route-safety-refresh/receipts/${RECEIPT_ID}`)).status).toBe(403);
    expect(unauthenticated.reconciliationService.run).not.toHaveBeenCalled();
    expect(nonAdmin.reconciliationService.run).not.toHaveBeenCalled();
  });

  test('returns an uncached, receipt-bound report without a write authorization gate', async () => {
    const { app, reconciliationService } = createApp({
      user: { id: 1, role: 'admin' },
      report: { mode: 'read_only', receipt: { retryReceipt: RECEIPT_ID }, records: [] },
    });

    const response = await request(app)
      .get(`/api/classification/pending/route-safety-refresh/receipts/${RECEIPT_ID}`);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ mode: 'read_only', receipt: { retryReceipt: RECEIPT_ID }, records: [] });
    expect(reconciliationService.run).toHaveBeenCalledWith({ receiptId: RECEIPT_ID });
  });
});
