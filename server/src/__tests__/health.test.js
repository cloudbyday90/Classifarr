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

const request = require('supertest');
const express = require('express');
const db = require('../config/database');
const healthCheckService = require('../services/healthCheckService');
const { createConsoleSpy } = require('./setup/consoleHelpers');

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn()
}));

// Mock the healthCheckService
jest.mock('../services/healthCheckService', () => ({
  checkDatabase: jest.fn(),
  getAllServicesHealth: jest.fn(),
  getUptime: jest.fn(),
  getHealthCache: jest.fn(),
  runAllHealthChecks: jest.fn(),
  checkQueueWorker: jest.fn()
}));

// Mock the auth middleware to avoid JWT dependency issues
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { userId: 1 };
    next();
  }
}));

describe('Health Endpoints', () => {
  let app;
  let consoleErrorSpy;

  beforeEach(() => {
    // Suppress console.error during tests
    consoleErrorSpy = createConsoleSpy('error', { suppress: true });

    // Create a minimal Express app with the health endpoints
    app = express();
    app.use(express.json());
    
    // Import the system routes
    const systemRoutes = require('../routes/system');
    app.use('/api/system', systemRoutes);

    // Clear all mocks before each test
    jest.clearAllMocks();
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
    const mockToken = 'valid-token';

    beforeEach(() => {
      // Mock database query for user lookup in auth middleware
      db.query.mockResolvedValue({ rows: [{ id: 1, username: 'testuser' }] });
    });

    test('should return 200 and health status when database is connected', async () => {
      healthCheckService.getHealthCache.mockReturnValue({
        database: { status: 'connected', lastCheck: new Date().toISOString(), responseTime: 5 },
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
      expect(response.body.imageEmbeddings).toBe('disabled');
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
    const mockToken = 'valid-token';

    beforeEach(() => {
      // Mock database query for user lookup
      db.query.mockResolvedValue({ rows: [{ id: 1, username: 'testuser' }] });
    });

    test('should return detailed service health', async () => {
      healthCheckService.getAllServicesHealth.mockResolvedValue({
        database: { status: 'connected', lastCheck: new Date().toISOString(), responseTime: 5 },
        mediaServer: { status: 'connected', lastCheck: new Date().toISOString(), responseTime: 45, type: 'Plex' },
        radarr: { 
          status: 'connected', 
          lastCheck: new Date().toISOString(),
          instances: [
            { name: '1080p', status: 'connected', responseTime: 23 },
            { name: '4K', status: 'connected', responseTime: 25 }
          ]
        },
        sonarr: { 
          status: 'connected', 
          lastCheck: new Date().toISOString(),
          instances: [
            { name: 'Main', status: 'connected', responseTime: 18 }
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
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.total).toBeGreaterThan(0);
      expect(response.body.summary.healthy).toBeDefined();
      expect(response.body.summary.unhealthy).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    test('should return degraded status when some services are unhealthy', async () => {
      healthCheckService.getAllServicesHealth.mockResolvedValue({
        database: { status: 'connected', lastCheck: new Date().toISOString(), responseTime: 5 },
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
      expect(response.body.overall).toBe('degraded');
      expect(response.body.summary.unhealthy).toBeGreaterThan(0);
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
});
