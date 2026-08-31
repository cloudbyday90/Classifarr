/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { errorHandler } from '../middleware/errorHandler.mjs';
import {
  registerPolicyCandidateCorrectionPolicyChangeOutcomeObservationRoutes,
} from '../routes/policiesRoutePolicyChangeOutcomeObservation.mjs';

function response({ operationId } = {}) {
  return {
    version: 'policy.candidate_correction_policy_change_outcome_observation.v1',
    statusId: 'not_started',
    startAvailable: false,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    routingChanged: false,
    observation: null,
    outcome: null,
    ...(operationId ? { operationId } : {}),
  };
}

function createApp({ user = { id: 7, role: 'admin' } } = {}) {
  const outcomeObservationService = {
    getOutcomeObservation: jest.fn().mockResolvedValue(response()),
    startOutcomeObservation: jest.fn().mockResolvedValue(response({ operationId: 'observation_started' })),
  };
  const rateLimit = jest.fn(() => (_req, _res, next) => next());
  const app = express();
  const router = express.Router();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyCandidateCorrectionPolicyChangeOutcomeObservationRoutes(router, {
    db: {},
    logger: { info: jest.fn() },
    rateLimit,
    outcomeObservationService,
  });
  app.use('/api/policies', router);
  app.use(errorHandler);
  return { app, outcomeObservationService, rateLimit };
}

describe('policy-change outcome observation routes', () => {
  test('requires an administrator and returns a no-store selector-free status', async () => {
    const { app, outcomeObservationService, rateLimit } = createApp();
    const result = await request(app)
      .get('/api/policies/candidate-correction/policy-change-outcome-observation')
      .expect(200);

    expect(result.headers['cache-control']).toBe('no-store');
    expect(outcomeObservationService.getOutcomeObservation).toHaveBeenCalledWith({ actorId: 7 });
    expect(rateLimit).toHaveBeenCalledTimes(2);

    await request(createApp({ user: { id: 8, role: 'operator' } }).app)
      .get('/api/policies/candidate-correction/policy-change-outcome-observation')
      .expect(403);
  });

  test('rejects caller-selected input and starts only the server-owned recent receipt flow', async () => {
    const { app, outcomeObservationService } = createApp();

    await request(app)
      .post('/api/policies/candidate-correction/policy-change-outcome-observation')
      .send({ policyId: 1 })
      .expect(400);
    expect(outcomeObservationService.startOutcomeObservation).not.toHaveBeenCalled();

    const result = await request(app)
      .post('/api/policies/candidate-correction/policy-change-outcome-observation')
      .send({})
      .expect(201);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(outcomeObservationService.startOutcomeObservation).toHaveBeenCalledWith({ actorId: 7 });
  });
});
