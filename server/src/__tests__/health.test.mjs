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
import express from 'express';
import request from 'supertest';
import { createConsoleSpy } from './setup/consoleHelpers.mjs';
import { createNamedMockModule, createAdminAuthMock} from './helpers/mockFactory.mjs';
import { createHealthFreshnessPolicy } from '../services/healthObservationFreshness.mjs';

const mockDb = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

const mockHealthCheckService = {
  checkDatabase: jest.fn(),
  checkProcessMemory: jest.fn(),
  getAllServicesHealth: jest.fn(),
  getUptime: jest.fn(),
  getHealthCache: jest.fn(),
  getHealthFreshnessPolicy: jest.fn(() => createHealthFreshnessPolicy()),
  runAllHealthChecks: jest.fn(),
  checkQueueWorker: jest.fn(),
  isHeartbeatRunning: jest.fn(),
  startHeartbeat: jest.fn(),
  stopHeartbeat: jest.fn(),
};
jest.unstable_mockModule('../services/healthCheckService.mjs', () => ({
  healthCheckService: {},
  ...mockHealthCheckService,
}));
jest.unstable_mockModule('../middleware/auth.mjs', () => createAdminAuthMock({ userId: 1 }));

const db = mockDb;
const healthCheckService = mockHealthCheckService;
const { router: systemRoutes } = await import('../routes/system.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

const app = express();
app.use(express.json());
app.use('/api/system', systemRoutes);
app.use(errorHandler);

describe('Health Endpoints', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    healthCheckService.checkDatabase.mockReset();
    healthCheckService.checkProcessMemory.mockReset();
    healthCheckService.getAllServicesHealth.mockReset();
    healthCheckService.getUptime.mockReset().mockReturnValue(12345);
    healthCheckService.getHealthCache.mockReset().mockReturnValue({});
    healthCheckService.getHealthFreshnessPolicy.mockReset().mockImplementation(() => createHealthFreshnessPolicy());
    healthCheckService.runAllHealthChecks.mockReset().mockResolvedValue({});
    healthCheckService.checkQueueWorker.mockReset().mockResolvedValue({
      status: 'connected',
      name: 'Queue Worker',
      latency: 0,
      timestamp: new Date().toISOString()
    });

    // Suppress console.error during tests
    consoleErrorSpy = createConsoleSpy('error', { suppress: true });
  });

  afterEach(() => {
    consoleErrorSpy.restore();
  });

  describe('GET /api/system/health/live', () => {
    test('should return 200 and alive status', async () => {
      const response = await request(app).get('/api/system/health/live');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('alive');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('should not require authentication', async () => {
      // Should not fail even without auth token
      const response = await request(app).get('/api/system/health/live');
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/system/health/ready', () => {
    test('should return 200 when database is healthy', async () => {
      healthCheckService.checkDatabase.mockResolvedValue({
        status: 'connected',
        lastCheck: new Date().toISOString()
      });

      const response = await request(app).get('/api/system/health/ready');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ready');
      expect(response.body.database).toBe('connected');
      expect(response.body.timestamp).toBeDefined();
    });

    test('should return 503 when database is unhealthy', async () => {
      healthCheckService.checkDatabase.mockResolvedValue({
        status: 'disconnected',
        lastCheck: new Date().toISOString(),
        error: 'Connection failed'
      });

      const response = await request(app).get('/api/system/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('not_ready');
      expect(response.body.database).toBe('disconnected');
    });

    test('should return 503 on error', async () => {
      healthCheckService.checkDatabase.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/system/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('not_ready');
      expect(response.body.error).toBe('Database error');
    });

    test('should not require authentication', async () => {
      healthCheckService.checkDatabase.mockResolvedValue({
        status: 'connected',
        lastCheck: new Date().toISOString()
      });

      const response = await request(app).get('/api/system/health/ready');
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/system/health', () => {
    test.each(['connected', 'disconnected'])('keeps raw database readiness %s while expiring old observations without renewing them', async status => {
      const now = Date.parse('2026-10-12T12:00:00.000Z');
      const lastCheck = '2026-10-12T11:44:30.000Z';
      const database = Object.freeze({ status, lastCheck });
      healthCheckService.getHealthCache.mockReturnValue({ database });
      healthCheckService.getHealthFreshnessPolicy.mockReturnValue(createHealthFreshnessPolicy({ now }));
      for (let read = 0; read < 2; read++) {
        const response = await request(app).get('/api/system/health');
        expect(response.status).toBe(status === 'connected' ? 200 : 503);
        expect(response.body.database).toBe(status);
        expect(response.body.details.database).toMatchObject({ status, lastCheck, effectiveStatus: 'unknown', freshness: { state: 'stale', checkedAt: lastCheck } });
        expect(response.body.freshnessPolicy).toMatchObject({ maxAgeMs: 930000, heartbeatActive: false });
      }
      expect(healthCheckService.runAllHealthChecks).not.toHaveBeenCalled();
      expect(database.lastCheck).toBe(lastCheck);
    });

    const mockToken = 'valid-token';

    beforeEach(() => {
      // Mock database query for user lookup in auth middleware
      db.query.mockResolvedValue({ rows: [{ id: 1, username: 'testuser' }] });
    });

    test('should return 200 and health status when database is connected', async () => {
      healthCheckService.getHealthCache.mockReturnValue({
        database: { status: 'connected', lastCheck: new Date().toISOString(), responseTime: 5 },
        rag: {
          status: 'available',
          lastCheck: new Date().toISOString(),
          pgvector: true,
          embeddingsTable: true,
          prewarm: true,
          indexes: { text: true, image: true, imageRequired: true, missing: [] },
          embeddingCount: 42,
          staleCount: 3,
          provider: 'local',
          model: 'nomic'
        },
        imageEmbeddings: { status: 'disabled', lastCheck: new Date().toISOString() }
      });
      healthCheckService.getUptime.mockReturnValue(302400); // 3d 14h in seconds
      healthCheckService.checkQueueWorker.mockResolvedValue({
        status: 'connected',
        name: 'Queue Worker',
        latency: 0,
        timestamp: new Date().toISOString()
      });

      const response = await request(app)
        .get('/api/system/health')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.version).toBeDefined();
      expect(response.body.uptime).toBe(302400);
      expect(response.body.database).toBe('connected');
      expect(response.body.rag).toBe('available');
      expect(response.body.imageEmbeddings).toBe('disabled');
      expect(response.body.details.rag.indexes.missing).toEqual([]);
      expect(response.body.timestamp).toBeDefined();
    });

    test('should return 503 when database is disconnected', async () => {
      healthCheckService.getHealthCache.mockReturnValue({
        database: { status: 'disconnected', lastCheck: new Date().toISOString(), error: 'Connection failed' }
      });
      healthCheckService.getUptime.mockReturnValue(3900); // 1h 5m in seconds
      healthCheckService.checkQueueWorker.mockResolvedValue({
        status: 'connected',
        name: 'Queue Worker',
        latency: 0,
        timestamp: new Date().toISOString()
      });

      const response = await request(app)
        .get('/api/system/health')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.database).toBe('disconnected');
    });

    test('should refresh health checks when refresh=true', async () => {
      healthCheckService.runAllHealthChecks.mockResolvedValue({
        database: { status: 'connected', lastCheck: new Date().toISOString(), responseTime: 5 }
      });
      healthCheckService.getUptime.mockReturnValue(150); // 2m 30s in seconds
      healthCheckService.checkQueueWorker.mockResolvedValue({
        status: 'connected',
        name: 'Queue Worker',
        latency: 0,
        timestamp: new Date().toISOString()
      });

      const response = await request(app)
        .get('/api/system/health?refresh=true')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(healthCheckService.runAllHealthChecks).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/system/health/services', () => {
    test('does not renew instance checks using a newer group timestamp or HTTP receipt', async () => {
      const now = Date.parse('2026-10-12T12:00:00.000Z');
      healthCheckService.getHealthFreshnessPolicy.mockReturnValue(createHealthFreshnessPolicy({ now, intervalMs: 60000, heartbeatActive: true }));
      healthCheckService.getAllServicesHealth.mockResolvedValue({
        radarr: { status: 'connected', lastCheck: new Date(now).toISOString(), instances: [
          { name: 'old', status: 'disconnected', lastCheck: new Date(now - 90000).toISOString() },
          { name: 'new', status: 'connected', lastCheck: new Date(now).toISOString() },
        ] },
        sonarr: { lastCheck: new Date(now).toISOString(), instances: [{ name: 'missing', status: 'connected' }] },
        timestamp: new Date(now).toISOString(),
      });
      const response = await request(app).get('/api/system/health/services');
      expect(response.status).toBe(200);
      expect(response.body.overall).toBe('unknown');
      expect(response.body.summary).toMatchObject({ healthy: 1, unknown: 2, failed: 0 });
      expect(response.body.services[0]).toMatchObject({ status: 'unknown', observedStatus: 'unhealthy', freshness: { state: 'stale' } });
      expect(response.body.services[2].freshness.reason).toBe('check_time_missing');
      expect(healthCheckService.runAllHealthChecks).not.toHaveBeenCalled();
    });

    const mockToken = 'valid-token';

    beforeEach(() => {
      // Mock database query for user lookup
      db.query.mockResolvedValue({ rows: [{ id: 1, username: 'testuser' }] });
    });

    test('should return detailed service health', async () => {
      healthCheckService.getAllServicesHealth.mockResolvedValue({
        database: { status: 'connected', lastCheck: new Date().toISOString(), responseTime: 5 },
        rag: {
          status: 'available',
          lastCheck: new Date().toISOString(),
          pgvector: true,
          embeddingsTable: true,
          prewarm: true,
          indexes: { text: true, image: true, imageRequired: true, missing: [] },
          embeddingCount: 42,
          staleCount: 3,
          provider: 'local',
          model: 'nomic'
        },
        mediaServer: { status: 'connected', lastCheck: new Date().toISOString(), responseTime: 45, type: 'Plex' },
        radarr: { 
          status: 'connected', 
          lastCheck: new Date().toISOString(),
          instances: [
            { name: '1080p', status: 'connected', responseTime: 23, lastCheck: new Date().toISOString() },
            { name: '4K', status: 'connected', responseTime: 25, lastCheck: new Date().toISOString() }
          ]
        },
        sonarr: { 
          status: 'connected', 
          lastCheck: new Date().toISOString(),
          instances: [
            { name: 'Main', status: 'connected', responseTime: 18, lastCheck: new Date().toISOString() }
          ]
        },
        aiProvider: { status: 'connected', lastCheck: new Date().toISOString(), responseTime: 150, provider: 'ollama' },
        queueWorker: { name: 'Queue Worker', status: 'healthy', latency: 0, timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString()
      });

      const response = await request(app)
        .get('/api/system/health/services')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.overall).toBe('healthy');
      expect(response.body.services).toBeInstanceOf(Array);
      expect(response.body.services.length).toBeGreaterThan(0);
      expect(response.body.services.some(service => service.name === 'RAG')).toBe(true);
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.total).toBeGreaterThan(0);
      expect(response.body.summary.healthy).toBeDefined();
      expect(response.body.summary.unhealthy).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    test('should return unhealthy status when some services are unhealthy', async () => {
      healthCheckService.getAllServicesHealth.mockResolvedValue({
        database: { status: 'connected', lastCheck: new Date().toISOString(), responseTime: 5 },
        rag: { status: 'unavailable', lastCheck: new Date().toISOString(), pgvector: false, embeddingsTable: false, prewarm: false, indexes: { text: false, image: false, imageRequired: false, missing: [] }, embeddingCount: 0, staleCount: 0 },
        mediaServer: { status: 'disconnected', lastCheck: new Date().toISOString(), responseTime: 0, type: 'Plex', error: 'Connection refused' },
        radarr: { status: 'not configured', lastCheck: new Date().toISOString(), instances: [] },
        sonarr: { status: 'not configured', lastCheck: new Date().toISOString(), instances: [] },
        aiProvider: { status: 'connected', lastCheck: new Date().toISOString(), responseTime: 150, provider: 'ollama' },
        queueWorker: { name: 'Queue Worker', status: 'healthy', latency: 0, timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString()
      });

      const response = await request(app)
        .get('/api/system/health/services')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.overall).toBe('unhealthy');
      expect(response.body.summary.unhealthy).toBeGreaterThan(0);
    });

    test.each([
      [{}, 'unknown', { total: 0, active: 0, healthy: 0 }],
      [{ queueWorker: { status: 'disabled' } }, 'unknown', { total: 1, active: 0, disabled: 1 }],
      [{ database: { status: 'connected' }, queueWorker: { status: 'unexpected' } }, 'unknown', { total: 2, active: 2, healthy: 0, unknown: 2 }],
      [{ aiProvider: { status: 'configured' } }, 'unknown', { total: 1, healthy: 0, degraded: 0, unhealthy: 0, unknown: 1 }],
    ])('summarizes incomplete/inactive observations conservatively: %j', async (health, overall, summary) => {
      healthCheckService.getAllServicesHealth.mockResolvedValue(health);
      const response = await request(app).get('/api/system/health/services').set('Authorization', `Bearer ${mockToken}`);
      expect(response.status).toBe(200);
      expect(response.body.overall).toBe(overall);
      expect(response.body.summary).toMatchObject(summary);
      expect(response.body.services.every(service => ['healthy', 'degraded', 'unhealthy', 'disabled', 'not_configured', 'unknown'].includes(service.status))).toBe(true);
    });

    test('should handle errors gracefully', async () => {
      healthCheckService.getAllServicesHealth.mockRejectedValue(new Error('Service check failed'));

      const response = await request(app)
        .get('/api/system/health/services')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to check service health');
      expect(response.body.message).toBe('Service check failed');
    });
  });
  describe('heartbeat interval contract', () => {
    test.each([null, 0, -1, 0.5, 1.5, '15', true, {}, [], 1441, 1e12])('rejects invalid minutes %j before scheduling', async intervalMinutes => {
      const response = await request(app).post('/api/system/heartbeat/start').send({ intervalMinutes });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('intervalMinutes must be a whole number between 1 and 1440');
      expect(healthCheckService.startHeartbeat).not.toHaveBeenCalled();
      expect(healthCheckService.runAllHealthChecks).not.toHaveBeenCalled();
    });
    test.each([1, 15, 1440])('accepts bounded whole minutes %i', async intervalMinutes => {
      expect((await request(app).post('/api/system/heartbeat/start').send({ intervalMinutes })).status).toBe(200);
      expect(healthCheckService.startHeartbeat).toHaveBeenCalledWith(intervalMinutes * 60000);
    });
    test('defaults omitted minutes, and reports the server policy on a read', async () => {
      expect((await request(app).post('/api/system/heartbeat/start').send({})).status).toBe(200);
      expect(healthCheckService.startHeartbeat).toHaveBeenCalledWith(900000);
      healthCheckService.isHeartbeatRunning.mockReturnValue(false);
      const response = await request(app).get('/api/system/heartbeat');
      expect(response.body).toMatchObject({ active: false, freshnessPolicy: { heartbeatActive: false, intervalMs: 900000 } });
    });
  });
});
