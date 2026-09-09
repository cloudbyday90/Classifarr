/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import express from 'express';
import { describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import { databaseHealthSummaryLimiterConfig } from '../config/rateLimits.mjs';
import {
  registerDatabaseHealthSummaryRoutes,
} from '../routes/statsRouteDatabaseHealthSummary.mjs';

function allowAdministrator(_req, _res, next) {
  next();
}

function denyAdministrator(_req, res) {
  res.status(403).json({ error: 'Admin access required' });
}

function createApp({ requireAdmin = allowAdministrator, getSummary = jest.fn() } = {}) {
  const app = express();
  const router = express.Router();
  const rateLimit = jest.fn(() => (_req, _res, next) => next());
  registerDatabaseHealthSummaryRoutes(router, {
    db: { query: jest.fn() },
    requireAdmin,
    rateLimit,
    createHealthSummaryService: () => ({ getSummary }),
  });
  app.use('/api/stats', router);
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({ error: error.message });
  });
  return { app, getSummary, rateLimit };
}

describe('statsRouteDatabaseHealthSummary', () => {
  test('returns only the fixed aggregate after authorization and prevents caching', async () => {
    const report = {
      version: 'database.health_summary.v1',
      observedAt: '2026-09-09T12:00:00.000Z',
      statisticsResetAt: '2026-09-08T00:00:00.000Z',
      io: { readOperations: 'low', writeOperations: 'none', cacheHits: 'moderate' },
      tableStatistics: { estimatedDeadTuples: 'low', tablesWithDeadTuples: 'low' },
    };
    const getSummary = jest.fn().mockResolvedValue(report);
    const { app, rateLimit } = createApp({ getSummary });

    const response = await request(app)
      .get('/api/stats/database-health-summary')
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual(report);
    expect(getSummary).toHaveBeenCalledWith();
    expect(rateLimit).toHaveBeenCalledWith(databaseHealthSummaryLimiterConfig);
  });

  test('does not execute the aggregate query for non-administrators', async () => {
    const getSummary = jest.fn();
    const { app } = createApp({ requireAdmin: denyAdministrator, getSummary });

    await request(app)
      .get('/api/stats/database-health-summary')
      .expect(403);

    expect(getSummary).not.toHaveBeenCalled();
  });

  test('rejects caller-supplied dimensions before reading statistics', async () => {
    const getSummary = jest.fn();
    const { app } = createApp({ getSummary });

    const response = await request(app)
      .get('/api/stats/database-health-summary?table=private')
      .expect(400);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(getSummary).not.toHaveBeenCalled();
  });

  test('requires administrator authorization and a rate-limit factory at registration time', () => {
    expect(() => registerDatabaseHealthSummaryRoutes(express.Router(), {
      db: {},
      rateLimit: () => (_req, _res, next) => next(),
    })).toThrow('requires administrator authorization');

    expect(() => registerDatabaseHealthSummaryRoutes(express.Router(), {
      db: {},
      requireAdmin: allowAdministrator,
    })).toThrow('requires a rate-limit factory');
  });
});
