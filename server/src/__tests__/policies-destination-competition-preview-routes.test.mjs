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

const preview = jest.fn();
class PolicyDestinationCompetitionPreviewNotFoundError extends Error {}

jest.unstable_mockModule('../services/policyDestinationCompetitionPreviewService.mjs', () => ({
  PolicyDestinationCompetitionPreviewNotFoundError,
  policyDestinationCompetitionPreviewService: { preview },
}));

const { registerPolicyDestinationCompetitionPreviewRoutes } =
  await import('../routes/policiesRoutePolicyDestinationCompetitionPreview.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

function createApp(user = { id: 7, role: 'admin' }) {
  const app = express();
  const router = express.Router();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyDestinationCompetitionPreviewRoutes(router, { db: { query: jest.fn() } });
  app.use('/api/policies', router);
  app.use(errorHandler);
  return app;
}

describe('Policy destination competition preview route', () => {
  beforeEach(() => {
    preview.mockReset();
    preview.mockResolvedValue({
      advisory: true,
      draftRetained: false,
      rawConfigurationExposed: false,
      rawHistoricItemsExposed: false,
      routingAffected: false,
      providerAccessed: false,
      databaseWritten: false,
    });
  });

  test('requires an administrator and forwards only the explicit draft', async () => {
    const draft = { schema_version: 1, presets: [] };
    await request(createApp())
      .post('/api/policies/17/native-intent/destination-competition-preview')
      .send({ policy_intent_draft: draft })
      .expect(200);

    expect(preview).toHaveBeenCalledWith({
      dbClient: expect.any(Object),
      policyId: 17,
      draft,
    });

    await request(createApp({ id: 9, role: 'operator' }))
      .post('/api/policies/17/native-intent/destination-competition-preview')
      .send({ policy_intent_draft: draft })
      .expect(403);
  });

  test('rejects scope expansion and maps an absent policy to not found', async () => {
    await request(createApp())
      .post('/api/policies/17/native-intent/destination-competition-preview')
      .send({ policy_intent_draft: {}, competitor_limit: 1000 })
      .expect(400);
    await request(createApp())
      .post('/api/policies/not-a-number/native-intent/destination-competition-preview')
      .send({ policy_intent_draft: {} })
      .expect(400);

    preview.mockRejectedValue(new PolicyDestinationCompetitionPreviewNotFoundError());
    await request(createApp())
      .post('/api/policies/99/native-intent/destination-competition-preview')
      .send({ policy_intent_draft: {} })
      .expect(404);
  });
});
