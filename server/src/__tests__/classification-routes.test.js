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
const { createConsoleSpy } = require('./setup/consoleHelpers');

// 1. Mock Logger FIRST to catch any early logs
jest.mock('../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

// 2. Mock Database with factory to prevent startup crashes
jest.mock('../config/database', () => {
  const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
  return {
    query: mockQuery,
    pool: {
      connect: jest.fn().mockResolvedValue({
        query: mockQuery,
        release: jest.fn(),
      }),
      on: jest.fn(),
    },
  };
});

// 3. Mock ProviderLock to prevent side effects
jest.mock('../services/providerLock', () => ({
  loadConfig: jest.fn(),
  acquireLock: jest.fn().mockResolvedValue(true),
  releaseLock: jest.fn(),
  heartbeat: jest.fn(),
}));

// 4. Mock other services
jest.mock('../services/classification');
jest.mock('../services/clarificationService');
jest.mock('../services/reclassificationService');
jest.mock('../services/patternReinforcementService');
jest.mock('../services/libraryProfileService');
jest.mock('../services/classificationRetryService');

// 5. Import modules (Standard top-level import)
const db = require('../config/database');
const classificationService = require('../services/classification');
const clarificationService = require('../services/clarificationService');
const classificationRetryService = require('../services/classificationRetryService');
const classificationRouter = require('../routes/classification');

describe('Classification Routes - Pending Resolution', () => {
  let app;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeAll(() => {
    consoleWarnSpy = createConsoleSpy('warn', { suppress: true });
    consoleErrorSpy = createConsoleSpy('error', { suppress: true });
  });

  afterAll(() => {
    consoleWarnSpy.restore();
    consoleErrorSpy.restore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset default mock implementations
    db.query.mockImplementation(async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT id FROM libraries')) {
        return { rows: [{ id: 1 }] };
      }
      return { rows: [] };
    });
    
    app = express();
    app.use(express.json());
    app.use('/api/classification', classificationRouter);
  });

  describe('POST /pending/:id/resolve', () => {
    test('should reject non-numeric library_id', async () => {
      const response = await request(app)
        .post('/api/classification/pending/1/resolve')
        .send({
          library_id: 'movies',
          selected_option: 'Movies',
          resolved_by: 'test-user'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid library_id');
      expect(clarificationService.resolvePolicyQuestion).not.toHaveBeenCalled();
    });

    test('should reject numeric library_id that does not exist', async () => {
      db.query.mockImplementationOnce(async () => ({ rows: [] }));

      const response = await request(app)
        .post('/api/classification/pending/1/resolve')
        .send({
          library_id: 9999,
          selected_option: 'Movies',
          resolved_by: 'test-user'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid library_id');
      expect(clarificationService.resolvePolicyQuestion).not.toHaveBeenCalled();
    });

    test('should reject invalid generate_rule values', async () => {
      const response = await request(app)
        .post('/api/classification/pending/1/resolve')
        .send({
          library_id: 10,
          generate_rule: 'maybe'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid generate_rule');
      expect(clarificationService.resolvePolicyQuestion).not.toHaveBeenCalled();
    });

    test('should resolve and route to Radarr when library has arr mapping', async () => {
      // Mock resolvePolicyQuestion response
      clarificationService.resolvePolicyQuestion.mockResolvedValue({
        success: true,
        classificationId: 1,
        libraryId: 10,
        libraryName: 'Action Movies',
        shouldRoute: true,
      });

      // Mock classification query with library data
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 10 }] })
        .mockResolvedValueOnce({
          // First call - get classification with library
          rows: [{
            id: 1,
            library_id: 10,
            metadata: JSON.stringify({ tmdb_id: 12345, title: 'Test Movie', year: 2024 }),
            arr_type: 'radarr',
            arr_id: 1,
            radarr_settings: { quality_profile_id: 4, root_folder_path: '/movies' },
            sonarr_settings: null,
            library_name: 'Action Movies'
          }]
        })
        .mockResolvedValueOnce({
          // Second call - update status to routed
          rows: []
        });

      // Mock routeToArr
      classificationService.routeToArr.mockResolvedValue({ routed: true, reason: 'routed', error: null });

      const response = await request(app)
        .post('/api/classification/pending/1/resolve')
        .send({
          library_id: 10,
          selected_option: 'Action Movies',
          resolved_by: 'test-user'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.routed).toBe(true);
      expect(response.body.routingError).toBe(null);

      // Verify routeToArr was called with correct parameters
      expect(classificationService.routeToArr).toHaveBeenCalledWith(
        { tmdb_id: 12345, title: 'Test Movie', year: 2024 },
        expect.objectContaining({
          id: 10,
          arr_type: 'radarr',
          arr_id: 1,
          radarr_settings: { quality_profile_id: 4, root_folder_path: '/movies' },
          sonarr_settings: null,
          name: 'Action Movies'
        })
      );

      // Verify status was updated to 'routed'
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE classification_history SET status'),
        expect.arrayContaining(['routed', 1])
      );
    });

    test('should resolve and route to Sonarr when library has arr mapping', async () => {
      clarificationService.resolvePolicyQuestion.mockResolvedValue({
        success: true,
        classificationId: 2,
        libraryId: 20,
        libraryName: 'TV Shows',
        shouldRoute: true,
      });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 20 }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 2,
            library_id: 20,
            metadata: JSON.stringify({ tmdb_id: 67890, title: 'Test Series', year: 2024 }),
            arr_type: 'sonarr',
            arr_id: 2,
            radarr_settings: null,
            sonarr_settings: { quality_profile_id: 3, root_folder_path: '/tv' },
            library_name: 'TV Shows'
          }]
        })
        .mockResolvedValueOnce({
          rows: []
        });

      classificationService.routeToArr.mockResolvedValue({ routed: true, reason: 'routed', error: null });

      const response = await request(app)
        .post('/api/classification/pending/2/resolve')
        .send({
          library_id: 20,
          selected_option: 'TV Shows'
        });

      expect(response.status).toBe(200);
      expect(response.body.routed).toBe(true);
      expect(classificationService.routeToArr).toHaveBeenCalled();
    });

    test('should not route when library lacks arr_type', async () => {
      clarificationService.resolvePolicyQuestion.mockResolvedValue({
        success: true,
        classificationId: 3,
        libraryId: 30,
        libraryName: 'No Arr Library',
        shouldRoute: true,
      });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 30 }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 3,
            library_id: 30,
            metadata: JSON.stringify({ tmdb_id: 11111, title: 'Test Movie' }),
            arr_type: null,  // No arr mapping
            arr_id: null,
            radarr_settings: null,
            sonarr_settings: null,
            library_name: 'No Arr Library'
          }]
        });

      const response = await request(app)
        .post('/api/classification/pending/3/resolve')
        .send({
          library_id: 30,
          selected_option: 'No Arr Library'
        });

      expect(response.status).toBe(200);
      expect(response.body.routed).toBe(false);
      expect(classificationService.routeToArr).not.toHaveBeenCalled();
    });

    test('should attempt routing when arr_id is missing but arr_type exists', async () => {
      clarificationService.resolvePolicyQuestion.mockResolvedValue({
        success: true,
        classificationId: 6,
        libraryId: 60,
        libraryName: 'Movies',
        shouldRoute: true,
      });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 60 }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 6,
            library_id: 60,
            metadata: JSON.stringify({ tmdb_id: 33333, title: 'Test Movie' }),
            arr_type: 'radarr',
            arr_id: null,
            radarr_settings: null,
            sonarr_settings: null,
            library_name: 'Movies'
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      classificationService.routeToArr.mockResolvedValue({ routed: true, reason: 'routed', error: null });

      const response = await request(app)
        .post('/api/classification/pending/6/resolve')
        .send({
          library_id: 60,
          selected_option: 'Movies'
        });

      expect(response.status).toBe(200);
      expect(classificationService.routeToArr).toHaveBeenCalled();
    });

    test('should succeed even if routing fails', async () => {
      clarificationService.resolvePolicyQuestion.mockResolvedValue({
        success: true,
        classificationId: 4,
        libraryId: 40,
        libraryName: 'Movies',
        shouldRoute: true,
      });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 40 }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 4,
            library_id: 40,
            metadata: JSON.stringify({ tmdb_id: 22222, title: 'Test Movie' }),
            arr_type: 'radarr',
            arr_id: 1,
            radarr_settings: { quality_profile_id: 4 },
            sonarr_settings: null,
            library_name: 'Movies'
          }]
        });

      // Mock routing failure
      const routingError = new Error('Radarr API connection failed');
      classificationService.routeToArr.mockRejectedValue(routingError);

      const response = await request(app)
        .post('/api/classification/pending/4/resolve')
        .send({
          library_id: 40,
          selected_option: 'Movies'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.routed).toBe(false);
      expect(response.body.routingError).toBe('Radarr API connection failed');
    });

    test('should return routing reason when routing is skipped without exception', async () => {
      clarificationService.resolvePolicyQuestion.mockResolvedValue({
        success: true,
        classificationId: 44,
        libraryId: 40,
        libraryName: 'TV Shows',
        shouldRoute: true,
      });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 40 }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 44,
            library_id: 40,
            metadata: JSON.stringify({ tmdb_id: 22222, title: 'Test Show' }),
            arr_type: 'sonarr',
            arr_id: 2,
            radarr_settings: null,
            sonarr_settings: { quality_profile_id: 4, root_folder_path: '/tv' },
            library_name: 'TV Shows'
          }]
        });

      classificationService.routeToArr.mockResolvedValue({
        routed: false,
        reason: 'missing_tvdb_id',
        error: null
      });

      const response = await request(app)
        .post('/api/classification/pending/44/resolve')
        .send({
          library_id: 40,
          selected_option: 'TV Shows'
        });

      expect(response.status).toBe(200);
      expect(response.body.routed).toBe(false);
      expect(response.body.routingError).toBe(null);
      expect(response.body.routingReason).toBe('missing_tvdb_id');
    });

    test('should handle metadata as object (JSONB)', async () => {
      clarificationService.resolvePolicyQuestion.mockResolvedValue({
        success: true,
        classificationId: 5,
        libraryId: 50,
        libraryName: 'Movies',
        shouldRoute: true,
      });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 50 }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 5,
            library_id: 50,
            metadata: { tmdb_id: 33333, title: 'Test Movie' },  // Already an object
            arr_type: 'radarr',
            arr_id: 1,
            radarr_settings: {},
            sonarr_settings: null,
            library_name: 'Movies'
          }]
        })
        .mockResolvedValueOnce({
          rows: []
        });

      classificationService.routeToArr.mockResolvedValue({ routed: true, reason: 'routed', error: null });

      const response = await request(app)
        .post('/api/classification/pending/5/resolve')
        .send({
          library_id: 50
        });

      expect(response.status).toBe(200);
      expect(classificationService.routeToArr).toHaveBeenCalledWith(
        { tmdb_id: 33333, title: 'Test Movie' },
        expect.any(Object)
      );
    });

    test('should return 400 when library_id is missing', async () => {
      const response = await request(app)
        .post('/api/classification/pending/1/resolve')
        .send({
          selected_option: 'Test'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('library_id is required');
    });

    test('should not route when shouldRoute is false', async () => {
      clarificationService.resolvePolicyQuestion.mockResolvedValue({
        success: true,
        classificationId: 6,
        libraryId: 60,
        libraryName: 'Movies',
        shouldRoute: false,  // Don't route
      });

      const response = await request(app)
        .post('/api/classification/pending/6/resolve')
        .send({
          library_id: 60
        });

      expect(response.status).toBe(200);
      expect(response.body.routed).toBe(false);
      expect(classificationService.routeToArr).not.toHaveBeenCalled();
    });

    test('should normalize generate_rule false string before calling clarificationService', async () => {
      clarificationService.resolvePolicyQuestion.mockResolvedValue({
        success: true,
        classificationId: 6,
        libraryId: 60,
        libraryName: 'Movies',
        shouldRoute: false,
      });

      const response = await request(app)
        .post('/api/classification/pending/6/resolve')
        .send({
          library_id: 60,
          generate_rule: 'false'
        });

      expect(response.status).toBe(200);
      expect(clarificationService.resolvePolicyQuestion).toHaveBeenCalledWith(
        6,
        60,
        'Manual selection',
        'admin',
        false
      );
    });

    test('should return service status codes for stale pending resolutions', async () => {
      clarificationService.resolvePolicyQuestion.mockRejectedValue(
        Object.assign(new Error('Classification is no longer awaiting decision'), { statusCode: 409 })
      );

      const response = await request(app)
        .post('/api/classification/pending/6/resolve')
        .send({
          library_id: 60
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Classification is no longer awaiting decision');
    });
  });

  describe('POST /retry', () => {
    test('returns 400 when classificationIds is missing', async () => {
      const response = await request(app)
        .post('/api/classification/retry')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('classificationIds must be an array');
      expect(classificationRetryService.retryClassifications).not.toHaveBeenCalled();
    });

    test('returns 400 when classificationIds is empty', async () => {
      const response = await request(app)
        .post('/api/classification/retry')
        .send({ classificationIds: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('classificationIds must contain at least one id');
      expect(classificationRetryService.retryClassifications).not.toHaveBeenCalled();
    });

    test('returns 400 when classificationIds includes invalid values', async () => {
      const response = await request(app)
        .post('/api/classification/retry')
        .send({ classificationIds: [1, 'invalid'] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('classificationIds must contain only positive integers');
      expect(classificationRetryService.retryClassifications).not.toHaveBeenCalled();
    });

    test('queues retries and returns summary payload', async () => {
      classificationRetryService.retryClassifications.mockResolvedValueOnce({
        correlationId: 'corr-id',
        requested: 2,
        queued: 2,
        skipped: 0,
        failed: 0,
        results: [
          { classificationId: 201, queued: true, reasonCode: 'queued', taskId: 9012 },
          { classificationId: 202, queued: true, reasonCode: 'queued', taskId: 9013 }
        ]
      });

      const response = await request(app)
        .post('/api/classification/retry')
        .send({
          classificationIds: [201, 202],
          options: { purgeLearning: true }
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        requested: 2,
        queued: 2,
        skipped: 0,
        failed: 0
      });
      expect(classificationRetryService.retryClassifications).toHaveBeenCalledWith(
        expect.objectContaining({
          classificationIds: [201, 202],
          purgeLearning: true,
          actor: 'admin'
        })
      );
    });

    test('blocks read-only API keys via requireReadWrite', async () => {
      const appWithReadOnlyKey = express();
      appWithReadOnlyKey.use(express.json());
      appWithReadOnlyKey.use((req, _res, next) => {
        req.apiKey = { permissions: 'read_only' };
        next();
      });
      appWithReadOnlyKey.use('/api/classification', classificationRouter);

      const response = await request(appWithReadOnlyKey)
        .post('/api/classification/retry')
        .send({ classificationIds: [201] });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('requires read-write permissions');
      expect(classificationRetryService.retryClassifications).not.toHaveBeenCalled();
    });

    test('returns 400 for service validation failures', async () => {
      const validationError = new Error('classificationIds exceeds maximum batch size (100)');
      validationError.code = 'VALIDATION_ERROR';
      classificationRetryService.retryClassifications.mockRejectedValueOnce(validationError);

      const response = await request(app)
        .post('/api/classification/retry')
        .send({ classificationIds: [1] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('classificationIds exceeds maximum batch size (100)');
    });

    test('returns 500 for unexpected errors', async () => {
      classificationRetryService.retryClassifications.mockRejectedValueOnce(new Error('db offline'));

      const response = await request(app)
        .post('/api/classification/retry')
        .send({ classificationIds: [201] });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('db offline');
    });
  });

  describe('GET /api/classification/pending/count', () => {
    test('excludes rows older than 7 days from the count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '3' }] });

      const response = await request(app)
        .get('/api/classification/pending/count');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(3);

      const [sql] = db.query.mock.calls[0];
      expect(sql).toMatch(/NOW\(\).*-.*INTERVAL/i);
      expect(sql).toMatch(/awaiting_decision/);
    });

    test('returns 500 on database error', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .get('/api/classification/pending/count');

      expect(response.status).toBe(500);
    });
  });
});
