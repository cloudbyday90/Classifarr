/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import { describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import {
  registerOllamaVerificationRuntimeMismatchSummaryRoutes,
} from '../routes/statsRouteOllamaVerificationRuntimeMismatchSummary.mjs';
import { ollamaVerificationRuntimeMismatchSummaryLimiterConfig } from '../config/rateLimits.mjs';

function allowAdministrator(_req, _res, next) {
  next();
}

function denyAdministrator(_req, res) {
  res.status(403).json({ error: 'Admin access required' });
}

describe('statsRouteOllamaVerificationRuntimeMismatchSummary', () => {
  test('returns the bounded aggregate only after administrator authorization', async () => {
    const getSummary = jest.fn().mockResolvedValue({
      version: 'ollama.verification_runtime_mismatch_summary.v1',
      modelDigestMismatchCount: '3',
      lastObservedAt: '2026-08-29T12:34:56.000Z',
    });
    const app = express();
    const router = express.Router();
    const rateLimit = jest.fn(() => (_req, _res, next) => next());
    registerOllamaVerificationRuntimeMismatchSummaryRoutes(router, {
      db: { query: jest.fn() },
      requireAdmin: allowAdministrator,
      rateLimit,
      createSummaryService: () => ({ getSummary }),
    });
    app.use('/api/stats', router);

    const response = await request(app)
      .get('/api/stats/ollama-verification-runtime-mismatch-summary')
      .expect(200);

    expect(response.body).toEqual({
      version: 'ollama.verification_runtime_mismatch_summary.v1',
      modelDigestMismatchCount: '3',
      lastObservedAt: '2026-08-29T12:34:56.000Z',
    });
    expect(getSummary).toHaveBeenCalledWith();
    expect(rateLimit).toHaveBeenCalledWith(ollamaVerificationRuntimeMismatchSummaryLimiterConfig);
  });

  test('does not execute the aggregate query for non-administrators', async () => {
    const getSummary = jest.fn();
    const app = express();
    const router = express.Router();
    registerOllamaVerificationRuntimeMismatchSummaryRoutes(router, {
      db: { query: jest.fn() },
      requireAdmin: denyAdministrator,
      rateLimit: () => (_req, _res, next) => next(),
      createSummaryService: () => ({ getSummary }),
    });
    app.use('/api/stats', router);

    await request(app)
      .get('/api/stats/ollama-verification-runtime-mismatch-summary')
      .expect(403);

    expect(getSummary).not.toHaveBeenCalled();
  });

  test('requires administrator authorization middleware at registration time', () => {
    expect(() => registerOllamaVerificationRuntimeMismatchSummaryRoutes(
      express.Router(),
      { db: {}, rateLimit: () => (_req, _res, next) => next() },
    )).toThrow('requires administrator authorization');
  });

  test('requires a rate-limit factory at registration time', () => {
    expect(() => registerOllamaVerificationRuntimeMismatchSummaryRoutes(
      express.Router(),
      { db: {}, requireAdmin: allowAdministrator },
    )).toThrow('requires a rate-limit factory');
  });
});
