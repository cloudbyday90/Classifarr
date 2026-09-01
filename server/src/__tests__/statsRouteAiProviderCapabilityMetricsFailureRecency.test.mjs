/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import { describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import {
  aiProviderCapabilityMetricsFailureRecencyLimiterConfig,
} from '../config/rateLimits.mjs';
import {
  registerAiProviderCapabilityMetricsFailureRecencyRoutes,
} from '../routes/statsRouteAiProviderCapabilityMetricsFailureRecency.mjs';

function allowAdministrator(_req, _res, next) {
  next();
}

function denyAdministrator(_req, res) {
  res.status(403).json({ error: 'Admin access required' });
}

describe('statsRouteAiProviderCapabilityMetricsFailureRecency', () => {
  test('returns the fixed recency aggregate only after administrator authorization', async () => {
    const getReport = jest.fn().mockResolvedValue({
      version: 'ai.provider_capability_metrics_failure_recency.v1',
      window: { days: 1, periodCount: 3 },
      periods: [],
      recency: { id: 'no_completed_persistence_warnings', completedDaysSinceLastWarning: null },
      status: { id: 'no_completed_persistence_warnings' },
    });
    const app = express();
    const router = express.Router();
    const rateLimit = jest.fn(() => (_req, _res, next) => next());
    registerAiProviderCapabilityMetricsFailureRecencyRoutes(router, {
      db: { query: jest.fn() },
      requireAdmin: allowAdministrator,
      rateLimit,
      createRecencyService: () => ({ getReport }),
    });
    app.use('/api/stats', router);

    const response = await request(app)
      .get('/api/stats/ai-provider-capability-metrics-failure-recency')
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      window: { days: 1, periodCount: 3 },
      recency: { id: 'no_completed_persistence_warnings' },
    });
    expect(getReport).toHaveBeenCalledWith();
    expect(rateLimit).toHaveBeenCalledWith(
      aiProviderCapabilityMetricsFailureRecencyLimiterConfig,
    );
  });

  test('does not execute the aggregate query for non-administrators', async () => {
    const getReport = jest.fn();
    const app = express();
    const router = express.Router();
    registerAiProviderCapabilityMetricsFailureRecencyRoutes(router, {
      db: { query: jest.fn() },
      requireAdmin: denyAdministrator,
      rateLimit: () => (_req, _res, next) => next(),
      createRecencyService: () => ({ getReport }),
    });
    app.use('/api/stats', router);

    await request(app)
      .get('/api/stats/ai-provider-capability-metrics-failure-recency')
      .expect(403);

    expect(getReport).not.toHaveBeenCalled();
  });
});
