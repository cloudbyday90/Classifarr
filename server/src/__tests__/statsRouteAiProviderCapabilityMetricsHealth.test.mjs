/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import { describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import { aiProviderCapabilityMetricsHealthLimiterConfig } from '../config/rateLimits.mjs';
import {
  registerAiProviderCapabilityMetricsHealthRoutes,
} from '../routes/statsRouteAiProviderCapabilityMetricsHealth.mjs';

function allowAdministrator(_req, _res, next) {
  next();
}

function denyAdministrator(_req, res) {
  res.status(403).json({ error: 'Admin access required' });
}

describe('statsRouteAiProviderCapabilityMetricsHealth', () => {
  test('returns the status-only aggregate only after administrator authorization', async () => {
    const getReport = jest.fn().mockResolvedValue({
      version: 'ai.provider_capability_metrics_health.v1',
      activeMetricStreamCount: '2',
      persistenceFailureCount: '0',
      status: { id: 'operational' },
    });
    const app = express();
    const router = express.Router();
    const rateLimit = jest.fn(() => (_req, _res, next) => next());
    registerAiProviderCapabilityMetricsHealthRoutes(router, {
      db: { query: jest.fn() },
      requireAdmin: allowAdministrator,
      rateLimit,
      createHealthService: () => ({ getReport }),
    });
    app.use('/api/stats', router);

    const response = await request(app)
      .get('/api/stats/ai-provider-capability-metrics-health')
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      activeMetricStreamCount: '2',
      status: { id: 'operational' },
    });
    expect(getReport).toHaveBeenCalledWith();
    expect(rateLimit).toHaveBeenCalledWith(aiProviderCapabilityMetricsHealthLimiterConfig);
  });

  test('does not execute the aggregate query for non-administrators', async () => {
    const getReport = jest.fn();
    const app = express();
    const router = express.Router();
    registerAiProviderCapabilityMetricsHealthRoutes(router, {
      db: { query: jest.fn() },
      requireAdmin: denyAdministrator,
      rateLimit: () => (_req, _res, next) => next(),
      createHealthService: () => ({ getReport }),
    });
    app.use('/api/stats', router);

    await request(app)
      .get('/api/stats/ai-provider-capability-metrics-health')
      .expect(403);

    expect(getReport).not.toHaveBeenCalled();
  });
});
