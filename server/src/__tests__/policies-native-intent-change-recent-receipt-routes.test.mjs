/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

const getRecentReceipt = jest.fn();

jest.unstable_mockModule('../services/policyNativeIntentChangeRecentReceiptDiscoveryService.mjs', () => ({
  policyNativeIntentChangeRecentReceiptDiscoveryService: { getRecentReceipt },
}));

const { registerPolicyNativeIntentChangeRecentReceiptDiscoveryRoutes } =
  await import('../routes/policiesRouteNativeIntentChangeRecentReceiptDiscovery.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

function discoveryResult(recentChange = null) {
  return {
    version: 'policy.native_intent_change_recent_receipt_discovery.v1',
    statusId: 'native_intent_change_recent_receipt_discovery_complete',
    mode: 'read_only',
    policyId: 17,
    recentChange,
    scope: {
      actorBound: true,
      policyBound: true,
      browserAuthorityAccepted: false,
      mutationAuthorized: false,
    },
    sideEffects: {
      storedReceiptRead: true,
      providerAccessed: false,
      policyStorageMutated: false,
      routingAffected: false,
      learningAffected: false,
      databaseWritten: false,
    },
    idempotencyKeyExposed: false,
    commandFingerprintExposed: false,
    commandValuesExposed: false,
    receiptHistoryExposed: false,
    receiptIdentifierExposed: false,
    receiptTimestampExposed: false,
    rawPolicyDataExposed: false,
    compatibilityDataExposed: false,
    aiDataExposed: false,
    routingDataExposed: false,
    learningDataExposed: false,
  };
}

function createApp(user = { id: 7, role: 'admin' }) {
  const app = express();
  const router = express.Router();
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyNativeIntentChangeRecentReceiptDiscoveryRoutes(router, {
    db: { withTransaction: jest.fn() },
  });
  app.use('/api/policies', router);
  app.use(errorHandler);
  return app;
}

describe('native intent change recent-receipt discovery route', () => {
  beforeEach(() => {
    getRecentReceipt.mockReset();
    getRecentReceipt.mockResolvedValue(discoveryResult({
      resultStatusId: 'applied',
      sourceIntentVersion: 3,
      targetIntentVersion: 4,
    }));
  });

  test('requires a stable admin actor, ignores no client scope, and marks the response no-store', async () => {
    const response = await request(createApp())
      .get('/api/policies/17/native-intent/change-receipts/recent')
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual(discoveryResult({
      resultStatusId: 'applied',
      sourceIntentVersion: 3,
      targetIntentVersion: 4,
    }));
    expect(getRecentReceipt).toHaveBeenCalledWith({
      dbClient: expect.any(Object),
      policyId: 17,
      actorId: 7,
    });

    await request(createApp({ id: 8, role: 'operator' }))
      .get('/api/policies/17/native-intent/change-receipts/recent')
      .expect(403);
    await request(createApp({ id: null, role: 'admin' }))
      .get('/api/policies/17/native-intent/change-receipts/recent')
      .expect(403);
  });

  test('rejects invalid route IDs and caller-controlled query scope', async () => {
    await request(createApp())
      .get('/api/policies/not-a-number/native-intent/change-receipts/recent')
      .expect(400);
    await request(createApp())
      .get('/api/policies/17/native-intent/change-receipts/recent?actor_id=8')
      .expect(400);
    expect(getRecentReceipt).not.toHaveBeenCalled();
  });

  test('maps a bounded unavailable result without disclosing a receipt', async () => {
    getRecentReceipt.mockResolvedValueOnce({
      statusId: 'native_intent_change_recent_receipt_discovery_unavailable',
    });

    const response = await request(createApp())
      .get('/api/policies/17/native-intent/change-receipts/recent')
      .expect(503);
    expect(response.body.code).toBe('POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_UNAVAILABLE');
  });

  test('fails closed if an injected reader widens the response contract', async () => {
    getRecentReceipt.mockResolvedValueOnce({
      ...discoveryResult(),
      receiptId: 'must-not-leak',
    });

    const response = await request(createApp())
      .get('/api/policies/17/native-intent/change-receipts/recent')
      .expect(503);

    expect(response.body.code).toBe('POLICY_NATIVE_INTENT_CHANGE_RECENT_RECEIPT_UNAVAILABLE');
    expect(response.body).not.toHaveProperty('receiptId');
  });
});
