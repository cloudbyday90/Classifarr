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

const getStatus = jest.fn();
const getReconciliationStatus = jest.fn();
const disableAutomation = jest.fn();
const resumeAutomation = jest.fn();
const resetCircuit = jest.fn();

jest.unstable_mockModule('../services/nativeIntentReconciliationLifecycleService.mjs', () => ({
  nativeIntentReconciliationLifecycleService: {
    approvePolicyReentry: jest.fn(),
  },
}));

jest.unstable_mockModule('../services/nativeIntentReconciliationControlService.mjs', () => ({
  nativeIntentReconciliationControlService: {
    getStatus,
    disableAutomation,
    resumeAutomation,
    resetCircuit,
  },
}));

jest.unstable_mockModule('../services/nativeIntentReconciliationStatusService.mjs', () => ({
  nativeIntentReconciliationStatusService: {
    getStatus: getReconciliationStatus,
  },
}));

const { registerPolicyNativeIntentReconciliationRoutes } =
  await import('../routes/policiesRouteNativeIntentReconciliation.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

function createApp(user = { id: 7, role: 'admin' }) {
  const app = express();
  const router = express.Router();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyNativeIntentReconciliationRoutes(router, {
    db: { query: jest.fn(), withTransaction: jest.fn() },
    logger: { info: jest.fn(), warn: jest.fn() },
  });
  app.use('/api/policies', router);
  app.use(errorHandler);
  return app;
}

describe('Policy native intent reconciliation control routes', () => {
  beforeEach(() => {
    getStatus.mockReset();
    getReconciliationStatus.mockReset();
    disableAutomation.mockReset();
    resumeAutomation.mockReset();
    resetCircuit.mockReset();
    getStatus.mockResolvedValue({
      automationEnabled: true,
      circuitState: 'closed',
      rawPayloadExposed: false,
    });
    getReconciliationStatus.mockResolvedValue({
      statusId: 'ready',
      rawPayloadExposed: false,
    });
    disableAutomation.mockResolvedValue({
      changed: true,
      reasonId: 'operator_incident',
      control: { automationEnabled: false, rawPayloadExposed: false },
      rawPayloadExposed: false,
    });
    resumeAutomation.mockResolvedValue({ changed: true, reasonId: 'operator_reviewed' });
    resetCircuit.mockResolvedValue({ changed: true, reasonId: 'schema_repaired' });
  });

  test('returns the administrator-only, bounded reconciliation control status', async () => {
    const response = await request(createApp())
      .get('/api/policies/native-intent-reconciliation/control')
      .expect(200);

    expect(response.body).toEqual(expect.objectContaining({
      automationEnabled: true,
      circuitState: 'closed',
      rawPayloadExposed: false,
    }));
    expect(getStatus).toHaveBeenCalledWith({ dbClient: expect.any(Object) });
  });

  test('returns the administrator-only, read-only reconciliation status contract', async () => {
    const response = await request(createApp())
      .get('/api/policies/native-intent-reconciliation/status')
      .expect(200);

    expect(response.body).toEqual(expect.objectContaining({
      statusId: 'ready',
      rawPayloadExposed: false,
    }));
    expect(getReconciliationStatus).toHaveBeenCalledWith({ dbClient: expect.any(Object) });
    await request(createApp({ id: 9, role: 'operator' }))
      .get('/api/policies/native-intent-reconciliation/status')
      .expect(403);
  });

  test('derives the emergency-stop actor from the authenticated administrator', async () => {
    await request(createApp())
      .post('/api/policies/native-intent-reconciliation/control/emergency-stop')
      .send({ reason_code: 'operator_incident', actor_id: 999 })
      .expect(200);

    expect(disableAutomation).toHaveBeenCalledWith({
      dbClient: expect.any(Object),
      action: { actorId: 7, reasonCode: 'operator_incident' },
    });
  });

  test('rejects invalid control actions and non-administrator access', async () => {
    resumeAutomation.mockResolvedValueOnce({ changed: false, reasonId: 'control_action_invalid' });
    await request(createApp())
      .post('/api/policies/native-intent-reconciliation/control/resume')
      .send({ reason_code: 'not valid' })
      .expect(400);
    await request(createApp({ id: 9, role: 'operator' }))
      .post('/api/policies/native-intent-reconciliation/control/reset')
      .send({ reason_code: 'schema_repaired' })
      .expect(403);
  });
});
