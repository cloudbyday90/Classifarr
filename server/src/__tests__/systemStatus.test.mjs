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

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createNamedMockModule, createPassThroughAuthMock} from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn() };

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

const mockAuth = {
  authenticateToken: (req, res, next) => {
    req.user = { userId: 1 };
    next();
  }
};

jest.unstable_mockModule('../middleware/auth.mjs', () => createPassThroughAuthMock());

const db = mockDb;

describe('System Status Endpoint', () => {
  let app;
  let healthCheckService;

  beforeEach(async () => {
    jest.resetModules();

    healthCheckService = {
      getUptime: jest.fn(() => 12345),
      checkDatabase: jest.fn(),
      checkProcessMemory: jest.fn(),
      getAllServicesHealth: jest.fn(),
      getHealthCache: jest.fn(),
      runAllHealthChecks: jest.fn(),
      checkQueueWorker: jest.fn()
    };

    jest.unstable_mockModule('../services/healthCheckService.mjs', () => ({
  healthCheckService: {},
      ...healthCheckService
    }));

    app = express();
    app.use(express.json());

    const { router: systemRoutes } = await import('../routes/system.mjs');
    app.use('/api/system', systemRoutes);

    jest.clearAllMocks();
  });

  test('returns pgvector details from settings', async () => {
    db.query.mockResolvedValue({
      rows: [
        { key: 'avx_guard_pgvector_selected', value: 'avx2' },
        { key: 'avx_guard_pgvector_build', value: 'multi' },
        { key: 'avx_guard_cpu_avx', value: 'true' },
        { key: 'avx_guard_cpu_avx2', value: 'true' },
        { key: 'avx_guard_last_run', value: '2026-01-30T12:00:00Z' }
      ]
    });

    const response = await request(app)
      .get('/api/system/status')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body.pgvector).toEqual({
      build: 'multi',
      selectedVariant: 'avx2',
      cpuAvx: 'true',
      cpuAvx2: 'true',
      lastChecked: '2026-01-30T12:00:00Z'
    });
  });

  test('returns null pgvector when settings lookup fails', async () => {
    db.query.mockRejectedValue(new Error('settings table missing'));

    const response = await request(app)
      .get('/api/system/status')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body.pgvector).toBeNull();
  });
});
