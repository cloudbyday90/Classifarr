/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import { describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import { aiProviderCapabilityMetricsHealthTrendLimiterConfig } from '../config/rateLimits.mjs';
import {
  registerAiProviderCapabilityMetricsHealthTrendRoutes,
} from '../routes/statsRouteAiProviderCapabilityMetricsHealthTrend.mjs';

function allowAdministrator(_req, _res, next) {
  next();
}

function denyAdministrator(_req, res) {
  res.status(403).json({ error: 'Admin access required' });
}

describe('statsRouteAiProviderCapabilityMetricsHealthTrend', () => {
  test('returns the fixed status-only trend only after administrator authorization', async () => {
    const getReport = jest.fn().mockResolvedValue({
      version: 'ai.provider_capability_metrics_health_trend.v1',
      window: { days: 1, periodCount: 3 },
      periods: [],
      status: { id: 'no_data' },
    });
    const app = express();
    const router = express.Router();
    const rateLimit = jest.fn(() => (_req, _res, next) => next());
    registerAiProviderCapabilityMetricsHealthTrendRoutes(router, {
      db: { query: jest.fn() },
      requireAdmin: allowAdministrator,
      rateLimit,
      createTrendService: () => ({ getReport }),
    });
    app.use('/api/stats', router);

    const response = await request(app)
      .get('/api/stats/ai-provider-capability-metrics-health-trend')
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      window: { days: 1, periodCount: 3 },
      status: { id: 'no_data' },
    });
    expect(getReport).toHaveBeenCalledWith();
    expect(rateLimit).toHaveBeenCalledWith(aiProviderCapabilityMetricsHealthTrendLimiterConfig);
  });

  test('does not execute the aggregate query for non-administrators', async () => {
    const getReport = jest.fn();
    const app = express();
    const router = express.Router();
    registerAiProviderCapabilityMetricsHealthTrendRoutes(router, {
      db: { query: jest.fn() },
      requireAdmin: denyAdministrator,
      rateLimit: () => (_req, _res, next) => next(),
      createTrendService: () => ({ getReport }),
    });
    app.use('/api/stats', router);

    await request(app)
      .get('/api/stats/ai-provider-capability-metrics-health-trend')
      .expect(403);

    expect(getReport).not.toHaveBeenCalled();
  });
});
