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
class PolicyPurposeCoveragePreflightNotFoundError extends Error {}

jest.unstable_mockModule('../services/policyPurposeCoveragePreflightService.mjs', () => ({
  PolicyPurposeCoveragePreflightNotFoundError,
  policyPurposeCoveragePreflightService: { preflight },
}));

const { registerPolicyPurposeCoveragePreflightRoutes } =
  await import('../routes/policiesRoutePolicyPurposeCoveragePreflight.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

function createApp(user = { id: 7, role: 'admin' }) {
  const app = express();
  const router = express.Router();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyPurposeCoveragePreflightRoutes(router, { db: { query: jest.fn() } });
  app.use('/api/policies', router);
  app.use(errorHandler);
  return app;
}

describe('Policy purpose coverage preflight route', () => {
  beforeEach(() => {
    preflight.mockReset();
    preflight.mockResolvedValue({
      advisory: true,
      draftRetained: false,
      rawConfigurationExposed: false,
      routingAffected: false,
      providerAccessed: false,
      databaseWritten: false,
    });
  });

  test('requires an administrator and forwards only the explicit draft to the server-owned preflight', async () => {
    const draft = { schema_version: 1, presets: [] };
    const response = await request(createApp())
      .post('/api/policies/17/native-intent/purpose-coverage/preflight')
      .send({ policy_intent_draft: draft })
      .expect(200);

    expect(response.body).toEqual(expect.objectContaining({
      advisory: true,
      draftRetained: false,
      rawConfigurationExposed: false,
    }));
    expect(preflight).toHaveBeenCalledWith({
      dbClient: expect.any(Object),
      policyId: 17,
      draft,
    });

    await request(createApp({ id: 9, role: 'operator' }))
      .post('/api/policies/17/native-intent/purpose-coverage/preflight')
      .send({ policy_intent_draft: draft })
      .expect(403);
  });

  test('rejects missing drafts, invalid identifiers, and attempts to expand the request contract', async () => {
    await request(createApp())
      .post('/api/policies/17/native-intent/purpose-coverage/preflight')
      .send({})
      .expect(400);
    await request(createApp())
      .post('/api/policies/17/native-intent/purpose-coverage/preflight')
      .send({ policy_intent_draft: {}, library_id: 999 })
      .expect(400);
    await request(createApp())
      .post('/api/policies/not-a-number/native-intent/purpose-coverage/preflight')
      .send({ policy_intent_draft: {} })
      .expect(400);

    expect(preflight).not.toHaveBeenCalled();
  });

  test('maps an absent persisted policy to a bounded not-found response', async () => {
    preflight.mockRejectedValue(new PolicyPurposeCoveragePreflightNotFoundError());

    await request(createApp())
      .post('/api/policies/99/native-intent/purpose-coverage/preflight')
      .send({ policy_intent_draft: {} })
      .expect(404);
  });
});
