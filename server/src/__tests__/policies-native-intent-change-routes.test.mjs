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

const applyPolicyNativeIntentChange = jest.fn();

jest.unstable_mockModule('../services/policyNativeIntentChangeService.mjs', () => ({
  POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS: {
    APPLIED: 'native_intent_change_applied',
    FAILED_ROLLED_BACK: 'native_intent_change_failed_rolled_back',
    BLOCKED_BY_TRANSACTION_BOUNDARY: 'native_intent_change_blocked_by_transaction_boundary',
    AUTHORIZATION_REJECTED: 'native_intent_change_authorization_rejected',
    STALE_REVISION: 'native_intent_change_stale_revision',
    RETRYABLE: 'native_intent_change_retryable',
  },
  applyPolicyNativeIntentChange,
}));

const { registerPolicyNativeIntentChangeRoutes } =
  await import('../routes/policiesRouteNativeIntentChange.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

function createApp(user = { id: 7, role: 'admin' }) {
  const app = express();
  const router = express.Router();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyNativeIntentChangeRoutes(router, {
    db: { withTransaction: jest.fn() },
    logger: { info: jest.fn() },
  });
  app.use('/api/policies', router);
  app.use(errorHandler);
  return app;
}

function validRequest() {
  return {
    expected_revision: 3,
    change_commands: [{
      command_id: 'update_purpose',
      values: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['Animation'] },
      }],
    }],
  };
}

describe('native intent change route', () => {
  beforeEach(() => {
    applyPolicyNativeIntentChange.mockReset();
    applyPolicyNativeIntentChange.mockResolvedValue({
      statusId: 'native_intent_change_applied',
      policyId: 17,
      change: { applied: true },
    });
  });

  test('accepts only the revision and typed commands, never browser authority or legacy payload', async () => {
    const body = validRequest();
    await request(createApp())
      .post('/api/policies/17/native-intent/changes')
      .send(body)
      .expect(200);

    expect(applyPolicyNativeIntentChange).toHaveBeenCalledWith(expect.objectContaining({
      policyId: '17',
      expectedRevision: 3,
      actorId: 7,
      actorRole: 'admin',
      changeCommands: body.change_commands,
      idempotencyKey: undefined,
    }));
    expect(applyPolicyNativeIntentChange.mock.calls[0][0]).not.toHaveProperty('authorityState');
    expect(applyPolicyNativeIntentChange.mock.calls[0][0]).not.toHaveProperty('legacyPayload');

    await request(createApp())
      .post('/api/policies/17/native-intent/changes')
      .send({ ...body, authority_state: { currentRevision: 3 } })
      .expect(400);
  });
});
