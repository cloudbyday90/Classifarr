/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import { describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import { ollamaVerificationCapabilityOutcomeHistoryLimiterConfig } from '../config/rateLimits.mjs';
import {
  registerOllamaVerificationCapabilityOutcomeHistoryRoutes,
} from '../routes/statsRouteOllamaVerificationCapabilityOutcomeHistory.mjs';

function allowAdministrator(_req, _res, next) {
  next();
}

function denyAdministrator(_req, res) {
  res.status(403).json({ error: 'Admin access required' });
}

describe('statsRouteOllamaVerificationCapabilityOutcomeHistory', () => {
  test('returns the bounded history only after administrator authorization', async () => {
    const getHistory = jest.fn().mockResolvedValue({
      version: 'ollama.verification_capability_outcome_history.v1',
      windowDays: 30,
      totalTests: '2',
      signal: { id: 'intermittent', label: 'Mixed test outcomes', message: 'advisory' },
      outcomes: [],
    });
    const app = express();
    const router = express.Router();
    const rateLimit = jest.fn(() => (_req, _res, next) => next());
    registerOllamaVerificationCapabilityOutcomeHistoryRoutes(router, {
      db: { query: jest.fn() },
      requireAdmin: allowAdministrator,
      rateLimit,
      createHistoryService: () => ({ getHistory }),
    });
    app.use('/api/stats', router);

    const response = await request(app)
      .get('/api/stats/ollama-verification-capability-outcomes')
      .expect(200);

    expect(response.body).toEqual(expect.objectContaining({
      totalTests: '2',
      signal: expect.objectContaining({ id: 'intermittent' }),
    }));
    expect(getHistory).toHaveBeenCalledWith();
    expect(rateLimit).toHaveBeenCalledWith(ollamaVerificationCapabilityOutcomeHistoryLimiterConfig);
  });

  test('does not execute the aggregate query for non-administrators', async () => {
    const getHistory = jest.fn();
    const app = express();
    const router = express.Router();
    registerOllamaVerificationCapabilityOutcomeHistoryRoutes(router, {
      db: { query: jest.fn() },
      requireAdmin: denyAdministrator,
      rateLimit: () => (_req, _res, next) => next(),
      createHistoryService: () => ({ getHistory }),
    });
    app.use('/api/stats', router);

    await request(app)
      .get('/api/stats/ollama-verification-capability-outcomes')
      .expect(403);

    expect(getHistory).not.toHaveBeenCalled();
  });
});
