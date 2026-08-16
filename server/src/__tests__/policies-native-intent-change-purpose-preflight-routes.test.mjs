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

const preflight = jest.fn();
class PolicyNativeIntentChangePurposePreflightValidationError extends Error {}
class PolicyNativeIntentChangePurposePreflightAuthorityError extends Error {}
class PolicyNativeIntentChangePurposePreflightNotFoundError extends Error {}
class PolicyNativeIntentChangePurposePreflightStaleRevisionError extends Error {}

jest.unstable_mockModule('../services/policyNativeIntentChangePurposePreflightContract.mjs', () => ({
  PolicyNativeIntentChangePurposePreflightValidationError,
}));
jest.unstable_mockModule('../services/policyNativeIntentChangePurposePreflightService.mjs', () => ({
  PolicyNativeIntentChangePurposePreflightAuthorityError,
  PolicyNativeIntentChangePurposePreflightNotFoundError,
  PolicyNativeIntentChangePurposePreflightStaleRevisionError,
  policyNativeIntentChangePurposePreflightService: { preflight },
}));

const { registerPolicyNativeIntentChangePurposePreflightRoutes } =
  await import('../routes/policiesRouteNativeIntentChangePurposePreflight.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

function validRequest() {
  return {
    expected_revision: 3,
    change_command: {
      command_id: 'update_purpose',
      values: [],
    },
  };
}

function createApp(user = { id: 7, role: 'admin' }) {
  const app = express();
  const router = express.Router();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyNativeIntentChangePurposePreflightRoutes(router, { db: { query: jest.fn() } });
  app.use('/api/policies', router);
  app.use(errorHandler);
  return app;
}

describe('native intent purpose change preflight route', () => {
  beforeEach(() => {
    preflight.mockReset();
    preflight.mockResolvedValue({
      advisory: true,
      commandRetained: false,
      rawConfigurationExposed: false,
      changeAuthorized: false,
      databaseWritten: false,
    });
  });

  test('requires an administrator and forwards only the exact revision-bound change command', async () => {
    const body = validRequest();
    const response = await request(createApp())
      .post('/api/policies/17/native-intent/changes/purpose-coverage/preflight')
      .send(body)
      .expect(200);

    expect(response.body).toEqual(expect.objectContaining({
      advisory: true,
      commandRetained: false,
      rawConfigurationExposed: false,
      changeAuthorized: false,
    }));
    expect(preflight).toHaveBeenCalledWith({
      dbClient: expect.any(Object),
      policyId: 17,
      expectedRevision: 3,
      changeCommand: body.change_command,
    });

    await request(createApp({ id: 9, role: 'operator' }))
      .post('/api/policies/17/native-intent/changes/purpose-coverage/preflight')
      .send(body)
      .expect(403);
  });

  test('rejects missing revisions, invalid identifiers, and payload expansion attempts', async () => {
    await request(createApp())
      .post('/api/policies/17/native-intent/changes/purpose-coverage/preflight')
      .send({ change_command: validRequest().change_command })
      .expect(400);
    await request(createApp())
      .post('/api/policies/17/native-intent/changes/purpose-coverage/preflight')
      .send({ ...validRequest(), authority_state: { currentRevision: 3 } })
      .expect(400);
    await request(createApp())
      .post('/api/policies/not-a-number/native-intent/changes/purpose-coverage/preflight')
      .send(validRequest())
      .expect(400);

    expect(preflight).not.toHaveBeenCalled();
  });

  test('maps stale and unavailable authority states to bounded conflicts', async () => {
    preflight.mockRejectedValueOnce(new PolicyNativeIntentChangePurposePreflightStaleRevisionError());
    const stale = await request(createApp())
      .post('/api/policies/17/native-intent/changes/purpose-coverage/preflight')
      .send(validRequest())
      .expect(409);
    expect(stale.body.code).toBe('POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_STALE_REVISION');

    preflight.mockRejectedValueOnce(new PolicyNativeIntentChangePurposePreflightAuthorityError());
    const unavailable = await request(createApp())
      .post('/api/policies/17/native-intent/changes/purpose-coverage/preflight')
      .send(validRequest())
      .expect(409);
    expect(unavailable.body.code).toBe('POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_AUTHORITY_UNAVAILABLE');
  });
});
