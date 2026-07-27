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
import { errorHandler } from '../middleware/errorHandler.mjs';
import {
  registerPolicyNativeIntentReadinessSummaryRoutes,
} from '../routes/policiesRouteNativeIntentReadinessSummary.mjs';

function buildSummary(overrides = {}) {
  return {
    version: 'policy.native_readiness_summary.v1',
    statusId: 'native_policy_readiness_available',
    policyId: 42,
    nativeIntent: {
      authoritative: true,
      intentVersion: 3,
      purposeRuleCount: 1,
      validationStateId: 'valid',
    },
    readiness: {
      stateId: 'ready',
      ready: true,
      nextAction: { actionId: 'continue_automation', label: 'Continue automation' },
      reasonCodes: ['ready_for_automation'],
    },
    ...overrides,
  };
}

function createApp(summary = buildSummary()) {
  const getSummary = jest.fn().mockResolvedValue(summary);
  const logger = { info: jest.fn(), warn: jest.fn() };
  const app = express();
  const router = express.Router();

  registerPolicyNativeIntentReadinessSummaryRoutes(router, {
    db: { query: jest.fn() },
    logger,
    nativeReadinessSummaryService: { getSummary },
  });
  app.use('/api/policies', router);
  app.use(errorHandler);

  return { app, getSummary, logger };
}

describe('policy native intent readiness summary routes', () => {
  test('returns the bounded server-owned native policy readiness summary', async () => {
    const expected = buildSummary();
    const { app, getSummary, logger } = createApp(expected);

    const response = await request(app)
      .get('/api/policies/42/native-intent/readiness-summary')
      .expect(200);

    expect(response.body).toEqual(expected);
    expect(getSummary).toHaveBeenCalledWith({
      dbClient: expect.objectContaining({ query: expect.any(Function) }),
      policyId: 42,
    });
    expect(logger.info).toHaveBeenCalledWith('Native policy readiness summary read', {
      policyId: 42,
      statusId: 'native_policy_readiness_available',
      readinessStateId: 'ready',
    });
  });

  test('rejects invalid IDs before it reads storage', async () => {
    const { app, getSummary } = createApp();

    await request(app)
      .get('/api/policies/not-a-number/native-intent/readiness-summary')
      .expect(400);

    expect(getSummary).not.toHaveBeenCalled();
  });

  test('returns bounded 404 and retry responses without exposing service internals', async () => {
    const missing = createApp(buildSummary({
      statusId: 'native_policy_readiness_policy_not_found',
      policyId: null,
      readiness: null,
    }));
    await request(missing.app)
      .get('/api/policies/42/native-intent/readiness-summary')
      .expect(404);

    const unavailable = createApp(buildSummary({
      statusId: 'native_policy_readiness_unavailable',
      internalError: 'never expose this',
      readiness: null,
    }));
    const response = await request(unavailable.app)
      .get('/api/policies/42/native-intent/readiness-summary')
      .expect(503);

    expect(response.body.code).toBe('POLICY_NATIVE_READINESS_UNAVAILABLE');
    expect(JSON.stringify(response.body)).not.toContain('never expose this');
  });
});
