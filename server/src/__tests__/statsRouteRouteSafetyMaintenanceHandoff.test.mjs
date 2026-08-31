/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import { describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import { routeSafetyMaintenanceHandoffLimiterConfig } from '../config/rateLimits.mjs';
import {
  registerRouteSafetyMaintenanceHandoffRoutes,
} from '../routes/statsRouteRouteSafetyMaintenanceHandoff.mjs';

function allowAdministrator(_req, _res, next) {
  next();
}

function denyAdministrator(_req, res) {
  res.status(403).json({ error: 'Admin access required' });
}

describe('statsRouteRouteSafetyMaintenanceHandoff', () => {
  test('returns the fixed advisory report only after administrator authorization', async () => {
    const getReport = jest.fn().mockResolvedValue({
      version: 'classification.route_safety_maintenance_handoff.v1',
      status: { id: 'review_recommended' },
      handoff: { gateId: 'policy_confirmation_required', currentCount: 4, previousCount: 5 },
    });
    const app = express();
    const router = express.Router();
    const rateLimit = jest.fn(() => (_req, _res, next) => next());
    registerRouteSafetyMaintenanceHandoffRoutes(router, {
      db: { query: jest.fn() },
      requireAdmin: allowAdministrator,
      rateLimit,
      createHandoffService: () => ({ getReport }),
    });
    app.use('/api/stats', router);

    const response = await request(app)
      .get('/api/stats/route-safety-maintenance-handoff')
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.status).toEqual({ id: 'review_recommended' });
    expect(getReport).toHaveBeenCalledWith();
    expect(rateLimit).toHaveBeenCalledWith(routeSafetyMaintenanceHandoffLimiterConfig);
  });

  test('does not execute the aggregate query for non-administrators', async () => {
    const getReport = jest.fn();
    const app = express();
    const router = express.Router();
    registerRouteSafetyMaintenanceHandoffRoutes(router, {
      db: { query: jest.fn() },
      requireAdmin: denyAdministrator,
      rateLimit: () => (_req, _res, next) => next(),
      createHandoffService: () => ({ getReport }),
    });
    app.use('/api/stats', router);

    await request(app)
      .get('/api/stats/route-safety-maintenance-handoff')
      .expect(403);

    expect(getReport).not.toHaveBeenCalled();
  });
});
