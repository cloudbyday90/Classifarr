/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import { describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import { routeSafetyReadinessLimiterConfig } from '../config/rateLimits.mjs';
import { registerRouteSafetyReadinessRoutes } from '../routes/statsRouteRouteSafetyReadiness.mjs';

function allowAdministrator(_req, _res, next) {
  next();
}

function denyAdministrator(_req, res) {
  res.status(403).json({ error: 'Admin access required' });
}

describe('statsRouteRouteSafetyReadiness', () => {
  test('returns the fixed aggregate only after administrator authorization', async () => {
    const getReport = jest.fn().mockResolvedValue({
      version: 'classification.route_safety_readiness.v1',
      observationCount: 2,
      primaryGates: [{ id: 'policy_confirmation_required', label: 'Policy confirmation', count: 2 }],
      status: { id: 'safeguards_observed' },
    });
    const app = express();
    const router = express.Router();
    const rateLimit = jest.fn(() => (_req, _res, next) => next());
    registerRouteSafetyReadinessRoutes(router, {
      db: { query: jest.fn() },
      requireAdmin: allowAdministrator,
      rateLimit,
      createReadinessService: () => ({ getReport }),
    });
    app.use('/api/stats', router);

    const response = await request(app)
      .get('/api/stats/route-safety-readiness')
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      observationCount: 2,
      status: { id: 'safeguards_observed' },
    });
    expect(getReport).toHaveBeenCalledWith();
    expect(rateLimit).toHaveBeenCalledWith(routeSafetyReadinessLimiterConfig);
  });

  test('does not execute the aggregate query for non-administrators', async () => {
    const getReport = jest.fn();
    const app = express();
    const router = express.Router();
    registerRouteSafetyReadinessRoutes(router, {
      db: { query: jest.fn() },
      requireAdmin: denyAdministrator,
      rateLimit: () => (_req, _res, next) => next(),
      createReadinessService: () => ({ getReport }),
    });
    app.use('/api/stats', router);

    await request(app)
      .get('/api/stats/route-safety-readiness')
      .expect(403);

    expect(getReport).not.toHaveBeenCalled();
  });
});
