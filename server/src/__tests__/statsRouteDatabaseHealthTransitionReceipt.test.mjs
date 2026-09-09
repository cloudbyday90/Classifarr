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

import { databaseHealthTransitionReceiptLimiterConfig } from '../config/rateLimits.mjs';
import {
  registerDatabaseHealthTransitionReceiptRoutes,
} from '../routes/statsRouteDatabaseHealthTransitionReceipt.mjs';

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
  registerDatabaseHealthTransitionReceiptRoutes(router, {
    db: { withTransaction: jest.fn() },
    requireAdmin,
    rateLimit,
    createReceiptReadService: () => ({ getSummary }),
  });
  app.use('/api/stats', router);
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({ error: error.message });
  });
  return { app, getSummary, rateLimit };
}

describe('statsRouteDatabaseHealthTransitionReceipt', () => {
  test('returns a fixed no-store receipt summary after authorization', async () => {
    const summary = {
      version: 'database.health_transition_receipt_summary.v1',
      status: { id: 'no_persistent_transition' },
      receipt: null,
    };
    const getSummary = jest.fn().mockResolvedValue(summary);
    const { app, rateLimit } = createApp({ getSummary });

    const response = await request(app)
      .get('/api/stats/database-health-transition-receipt')
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual(summary);
    expect(getSummary).toHaveBeenCalledWith();
    expect(rateLimit).toHaveBeenCalledWith(databaseHealthTransitionReceiptLimiterConfig);
  });

  test('does not read a receipt for non-administrators or caller dimensions', async () => {
    const denied = createApp({ requireAdmin: denyAdministrator });
    await request(denied.app)
      .get('/api/stats/database-health-transition-receipt')
      .expect(403);
    expect(denied.getSummary).not.toHaveBeenCalled();

    const parameterized = createApp();
    const response = await request(parameterized.app)
      .get('/api/stats/database-health-transition-receipt?history=all')
      .expect(400);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(parameterized.getSummary).not.toHaveBeenCalled();
  });

  test('requires administrator authorization and a rate-limit factory at registration time', () => {
    expect(() => registerDatabaseHealthTransitionReceiptRoutes(express.Router(), {
      db: {},
      rateLimit: () => (_req, _res, next) => next(),
    })).toThrow('requires administrator authorization');

    expect(() => registerDatabaseHealthTransitionReceiptRoutes(express.Router(), {
      db: {},
      requireAdmin: allowAdministrator,
    })).toThrow('requires a rate-limit factory');
  });
});
