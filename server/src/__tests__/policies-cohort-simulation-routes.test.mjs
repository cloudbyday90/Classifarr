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

const simulate = jest.fn();
class PolicyCohortSimulationNotFoundError extends Error {}

jest.unstable_mockModule('../services/policyCohortSimulationService.mjs', () => ({
  PolicyCohortSimulationNotFoundError,
  policyCohortSimulationService: { simulate },
}));

const { registerPolicyCohortSimulationRoutes } =
  await import('../routes/policiesRoutePolicyCohortSimulation.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

function createApp(user = { id: 7, role: 'admin' }) {
  const app = express();
  const router = express.Router();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyCohortSimulationRoutes(router, { db: { query: jest.fn() } });
  app.use('/api/policies', router);
  app.use(errorHandler);
  return app;
}

describe('Policy cohort simulation route', () => {
  beforeEach(() => {
    simulate.mockReset();
    simulate.mockResolvedValue({
      advisory: true,
      draftRetained: false,
      rawConfigurationExposed: false,
      rawHistoricItemsExposed: false,
      routingAffected: false,
      providerAccessed: false,
      databaseWritten: false,
    });
  });

  test('requires an administrator and forwards only the explicit draft to the read-only server simulator', async () => {
    const draft = { schema_version: 1, presets: [] };
    const response = await request(createApp())
      .post('/api/policies/17/native-intent/cohort-simulation')
      .send({ policy_intent_draft: draft })
      .expect(200);

    expect(response.body).toEqual(expect.objectContaining({
      advisory: true,
      draftRetained: false,
      rawHistoricItemsExposed: false,
      routingAffected: false,
      providerAccessed: false,
      databaseWritten: false,
    }));
    expect(simulate).toHaveBeenCalledWith({
      dbClient: expect.any(Object),
      policyId: 17,
      draft,
    });

    await request(createApp({ id: 9, role: 'operator' }))
      .post('/api/policies/17/native-intent/cohort-simulation')
      .send({ policy_intent_draft: draft })
      .expect(403);
  });

  test('rejects missing drafts, invalid identifiers, and request-scope expansion', async () => {
    await request(createApp())
      .post('/api/policies/17/native-intent/cohort-simulation')
      .send({})
      .expect(400);
    await request(createApp())
      .post('/api/policies/17/native-intent/cohort-simulation')
      .send({ policy_intent_draft: {}, maximum_items: 5000 })
      .expect(400);
    await request(createApp())
      .post('/api/policies/not-a-number/native-intent/cohort-simulation')
      .send({ policy_intent_draft: {} })
      .expect(400);

    expect(simulate).not.toHaveBeenCalled();
  });

  test('maps an absent persisted policy to a bounded not-found response', async () => {
    simulate.mockRejectedValue(new PolicyCohortSimulationNotFoundError());

    await request(createApp())
      .post('/api/policies/99/native-intent/cohort-simulation')
      .send({ policy_intent_draft: {} })
      .expect(404);
  });
});
