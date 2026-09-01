/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import { describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import {
  aiProviderCapabilityMetricsFailureBreakdownLimiterConfig,
} from '../config/rateLimits.mjs';
import {
  registerAiProviderCapabilityMetricsFailureBreakdownRoutes,
} from '../routes/statsRouteAiProviderCapabilityMetricsFailureBreakdown.mjs';

function allowAdministrator(_req, _res, next) {
  next();
}

function denyAdministrator(_req, res) {
  res.status(403).json({ error: 'Admin access required' });
}

describe('statsRouteAiProviderCapabilityMetricsFailureBreakdown', () => {
  test('returns the fixed aggregate only after administrator authorization', async () => {
    const getReport = jest.fn().mockResolvedValue({
      version: 'ai.provider_capability_metrics_failure_breakdown.v1',
      totalFailureCount: '1',
      safeCategoryFailureCount: '1',
      status: { id: 'complete' },
    });
    const app = express();
    const router = express.Router();
    const rateLimit = jest.fn(() => (_req, _res, next) => next());
    registerAiProviderCapabilityMetricsFailureBreakdownRoutes(router, {
      db: { query: jest.fn() },
      requireAdmin: allowAdministrator,
      rateLimit,
      createBreakdownService: () => ({ getReport }),
    });
    app.use('/api/stats', router);

    const response = await request(app)
      .get('/api/stats/ai-provider-capability-metrics-failure-breakdown')
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      totalFailureCount: '1',
      status: { id: 'complete' },
    });
    expect(getReport).toHaveBeenCalledWith();
    expect(rateLimit).toHaveBeenCalledWith(
      aiProviderCapabilityMetricsFailureBreakdownLimiterConfig,
    );
  });

  test('does not query the aggregate for non-administrators', async () => {
    const getReport = jest.fn();
    const app = express();
    const router = express.Router();
    registerAiProviderCapabilityMetricsFailureBreakdownRoutes(router, {
      db: { query: jest.fn() },
      requireAdmin: denyAdministrator,
      rateLimit: () => (_req, _res, next) => next(),
      createBreakdownService: () => ({ getReport }),
    });
    app.use('/api/stats', router);

    await request(app)
      .get('/api/stats/ai-provider-capability-metrics-failure-breakdown')
      .expect(403);

    expect(getReport).not.toHaveBeenCalled();
  });
});
