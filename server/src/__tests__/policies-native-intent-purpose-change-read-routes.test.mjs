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

const getPurposeChange = jest.fn();

jest.unstable_mockModule('../services/policyNativeIntentPurposeChangeReadService.mjs', () => ({
  policyNativeIntentPurposeChangeReadService: { getPurposeChange },
}));

const { registerPolicyNativeIntentPurposeChangeReadRoutes } =
  await import('../routes/policiesRouteNativeIntentPurposeChangeRead.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

function createApp(user = { id: 7, role: 'admin' }) {
  const app = express();
  const router = express.Router();
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyNativeIntentPurposeChangeReadRoutes(router, { db: { query: jest.fn() } });
  app.use('/api/policies', router);
  app.use(errorHandler);
  return app;
}

describe('native intent purpose-change read route', () => {
  beforeEach(() => {
    getPurposeChange.mockReset();
    getPurposeChange.mockResolvedValue({
      statusId: 'native_intent_purpose_change_available',
      policyId: 17,
      revision: 3,
      changeCommand: { command_id: 'update_purpose', values: [{ signal_type: 'genres' }] },
    });
  });

  test('requires admin authorization and forwards only the route policy identifier', async () => {
    const response = await request(createApp())
      .get('/api/policies/17/native-intent/purpose-change')
      .expect(200);

    expect(response.body).toEqual(expect.objectContaining({
      policyId: 17,
      revision: 3,
      changeCommand: expect.objectContaining({ command_id: 'update_purpose' }),
    }));
    expect(getPurposeChange).toHaveBeenCalledWith({
      dbClient: expect.any(Object),
      policyId: 17,
    });

    await request(createApp({ id: 8, role: 'operator' }))
      .get('/api/policies/17/native-intent/purpose-change')
      .expect(403);
  });

  test('maps invalid policy identifiers and unavailable server authority without widening the read', async () => {
    await request(createApp())
      .get('/api/policies/not-a-number/native-intent/purpose-change')
      .expect(400);
    expect(getPurposeChange).not.toHaveBeenCalled();

    getPurposeChange.mockResolvedValueOnce({
      statusId: 'native_intent_purpose_change_authority_unavailable',
      policyId: 17,
    });
    const unavailable = await request(createApp())
      .get('/api/policies/17/native-intent/purpose-change')
      .expect(409);
    expect(unavailable.body.code).toBe('POLICY_NATIVE_INTENT_PURPOSE_CHANGE_AUTHORITY_UNAVAILABLE');
  });
});
