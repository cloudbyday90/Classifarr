/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

const getSuggestion = jest.fn();

jest.unstable_mockModule('../services/policyNativeIntentConfirmedOutcomePurposeSuggestionService.mjs', () => ({
  policyNativeIntentConfirmedOutcomePurposeSuggestionService: { getSuggestion },
}));

const { registerPolicyNativeIntentConfirmedOutcomePurposeSuggestionRoutes } =
  await import('../routes/policiesRouteNativeIntentConfirmedOutcomePurposeSuggestion.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

function createApp(user = { id: 7, role: 'admin' }) {
  const app = express();
  const router = express.Router();
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyNativeIntentConfirmedOutcomePurposeSuggestionRoutes(router, {
    db: { query: jest.fn() },
  });
  app.use('/api/policies', router);
  app.use(errorHandler);
  return app;
}

describe('native intent confirmed-outcome purpose-suggestion route', () => {
  beforeEach(() => {
    getSuggestion.mockReset();
    getSuggestion.mockResolvedValue({
      statusId: 'native_intent_confirmed_outcome_purpose_suggestion_available',
      policyId: 17,
      available: true,
    });
  });

  test('requires an administrator and returns one no-store suggestion read', async () => {
    const response = await request(createApp())
      .get('/api/policies/17/native-intent/confirmed-outcome-purpose-suggestion')
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual(expect.objectContaining({ policyId: 17, available: true }));
    expect(getSuggestion).toHaveBeenCalledWith({
      dbClient: expect.any(Object),
      policyId: 17,
    });

    await request(createApp({ id: 8, role: 'operator' }))
      .get('/api/policies/17/native-intent/confirmed-outcome-purpose-suggestion')
      .expect(403);
  });

  test('rejects invalid identifiers and maps unavailable authority and reads', async () => {
    await request(createApp())
      .get('/api/policies/not-a-number/native-intent/confirmed-outcome-purpose-suggestion')
      .expect(400);
    expect(getSuggestion).not.toHaveBeenCalled();

    getSuggestion.mockResolvedValueOnce({
      statusId: 'native_intent_confirmed_outcome_purpose_suggestion_authority_unavailable',
    });
    await request(createApp())
      .get('/api/policies/17/native-intent/confirmed-outcome-purpose-suggestion')
      .expect(409);

    getSuggestion.mockResolvedValueOnce({
      statusId: 'native_intent_confirmed_outcome_purpose_suggestion_unavailable',
    });
    await request(createApp())
      .get('/api/policies/17/native-intent/confirmed-outcome-purpose-suggestion')
      .expect(503);
  });
});
