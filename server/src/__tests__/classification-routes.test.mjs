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
import { createConsoleSpy } from './setup/consoleHelpers.js';

const mockLoggerModule = {
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
};

const mockDb = (() => {
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
})();

const mockProviderLock = {
  loadConfig: jest.fn(),
  acquireLock: jest.fn().mockResolvedValue(true),
  releaseLock: jest.fn(),
  heartbeat: jest.fn(),
};

const mockClassificationService = {
  routeToArr: jest.fn(),
};

const mockClarificationService = {
  getPendingClassifications: jest.fn(),
  resolvePolicyQuestion: jest.fn(),
};

const mockClassificationOutcomeService = {};

const mockReclassificationService = {};

const mockPatternReinforcementService = {};

const mockClassificationEvidenceReinforcementService = {};

const mockLibraryProfileService = {};

const mockClassificationRetryService = {
  retryClassifications: jest.fn(),
};

jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLoggerModule, default: mockLoggerModule }));

jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

jest.unstable_mockModule('../services/providerLock.mjs', () => ({ ...mockProviderLock, default: mockProviderLock }));

jest.unstable_mockModule('../services/classification.mjs', () => ({ ...mockClassificationService, default: mockClassificationService }));

jest.unstable_mockModule('../services/clarificationService.mjs', () => ({ ...mockClarificationService, default: mockClarificationService }));

jest.unstable_mockModule('../services/classificationOutcomeService.mjs', () => ({
  ...mockClassificationOutcomeService,
  classificationOutcomeService: mockClassificationOutcomeService
}));

jest.unstable_mockModule('../services/reclassificationService.mjs', () => ({ ...mockReclassificationService, default: mockReclassificationService }));

jest.unstable_mockModule('../services/patternReinforcementService.mjs', () => ({ ...mockPatternReinforcementService, default: mockPatternReinforcementService }));

jest.unstable_mockModule('../services/classificationEvidenceReinforcementService.mjs', () => ({ ...mockClassificationEvidenceReinforcementService, default: mockClassificationEvidenceReinforcementService }));

jest.unstable_mockModule('../services/libraryProfileService.mjs', () => ({ ...mockLibraryProfileService, default: mockLibraryProfileService }));

jest.unstable_mockModule('../services/classificationRetryService.mjs', () => ({
  ...mockClassificationRetryService,
  classificationRetryService: mockClassificationRetryService
}));

const { createClassificationRouter } = await import('../routes/classificationRouteShared.mjs');
const { PATTERN_SIGNAL_TYPES } = await import('../services/signalCollector.mjs');
const { requireReadWrite } = await import('../middleware/apiKeyAuth.mjs');
const { STALE_AWAITING_DECISION_DAYS } = await import('../constants/classificationFlow.mjs');
const { default: classificationEvidenceService } = await import('../services/classificationEvidenceService.mjs');

const db = mockDb;
const classificationService = mockClassificationService;
const clarificationService = mockClarificationService;
const classificationRetryService = mockClassificationRetryService;
const classificationOutcomeService = mockClassificationOutcomeService;
const classificationEvidenceReinforcementService = mockClassificationEvidenceReinforcementService;
const { createLogger } = mockLoggerModule;

function buildClassificationRouter(loadReclassificationService = jest.fn().mockResolvedValue({})) {
  return createClassificationRouter({
    express,
    db,
    classificationService,
    classificationRetryService,
    classificationOutcomeService,
    clarificationService,
    classificationEvidenceService,
    classificationEvidenceReinforcementService,
    PATTERN_SIGNAL_TYPES,
    createLogger,
    requireReadWrite,
    STALE_AWAITING_DECISION_DAYS,
    loadReclassificationService,
  });
}

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
    clarificationService.getPendingClassifications.mockReset();
    clarificationService.getPendingClassifications.mockResolvedValue([]);

    // Reset default mock implementations
    db.query.mockImplementation(async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT id FROM libraries')) {
        return { rows: [{ id: 1 }] };
      }
      return { rows: [] };
    });
    
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: 1, username: 'admin', role: 'admin' };
      next();
    });
    app.use('/api/classification', buildClassificationRouter());
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

    test('should return 409 when the policy question is stale', async () => {
      clarificationService.resolvePolicyQuestion.mockRejectedValue(
        Object.assign(
          new Error('Policy question is stale and must be retried'),
          { statusCode: 409, code: 'policy_question_stale' }
        )
      );

      const response = await request(app)
        .post('/api/classification/pending/6/resolve')
        .send({
          library_id: 60
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Policy question is stale and must be retried');
    });

    test('should return 400 when the selected library is not a current policy option', async () => {
      clarificationService.resolvePolicyQuestion.mockRejectedValue(
        Object.assign(
          new Error('Selected library is no longer valid for this policy question'),
          { statusCode: 400, code: 'invalid_policy_option' }
        )
      );

      const response = await request(app)
        .post('/api/classification/pending/6/resolve')
        .send({
          library_id: 60
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Selected library is no longer valid for this policy question');
    });
  });

  describe('GET /pending', () => {
    test('returns pending items and preserves stale policy-question flags', async () => {
      clarificationService.getPendingClassifications.mockResolvedValueOnce([{
        id: 101,
        title: 'The Lost Forest',
        status: 'awaiting_decision',
        policy_question: {
          question: 'Which library should this go to?',
          options: [{ label: 'Movies', library_id: 8 }]
        },
        policy_question_stale: true,
        policy_question_stale_reason: 'policy_context_changed',
        policy_question_current_context_version: '2026-03-15T00:00:00.000Z'
      }]);

      const response = await request(app)
        .get('/api/classification/pending');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.items[0].policy_question.question).toBe('Which library should this go to?');
      expect(response.body.items[0].policy_question_stale).toBe(true);
      expect(response.body.items[0].policy_question_stale_reason).toBe('policy_context_changed');
      expect(response.body.items[0].policy_question_current_context_version).toBe('2026-03-15T00:00:00.000Z');
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

    test('preserves exact-match learning by default for manual retries', async () => {
      classificationRetryService.retryClassifications.mockResolvedValueOnce({
        correlationId: 'corr-default-preserve',
        requested: 1,
        queued: 1,
        skipped: 0,
        failed: 0,
        results: [
          { classificationId: 204, queued: true, reasonCode: 'queued', taskId: 9014 }
        ]
      });

      const response = await request(app)
        .post('/api/classification/retry')
        .send({
          classificationIds: [204]
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        requested: 1,
        queued: 1
      });
      expect(classificationRetryService.retryClassifications).toHaveBeenCalledWith(
        expect.objectContaining({
          classificationIds: [204],
          purgeLearning: false,
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
      appWithReadOnlyKey.use('/api/classification', buildClassificationRouter());

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

  describe('GET /second-pass-evaluation', () => {
    test('returns default cohort report with normalized rates', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            cohort: 'baseline',
            total: 20,
            linked_outcomes: 8,
            verified: 3,
            corrected: 2,
            resolved: 1,
            retried: 2,
            first_verified: 2,
            first_corrected: 3,
            first_resolved: 1,
            first_retried: 1,
            multi_step_outcomes: 2
          },
          {
            cohort: 'pass2_adopted',
            total: 10,
            linked_outcomes: 6,
            verified: 4,
            corrected: 1,
            resolved: 0,
            retried: 1,
            first_verified: 5,
            first_corrected: 0,
            first_resolved: 0,
            first_retried: 1,
            multi_step_outcomes: 3
          }
        ]
      });

      const response = await request(app)
        .get('/api/classification/second-pass-evaluation?days=14');

      expect(response.status).toBe(200);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WITH classified AS'),
        [14]
      );
      expect(response.body.windowDays).toBe(14);
      expect(response.body.totals).toMatchObject({
        total: 30,
        linkedOutcomes: 14,
        verified: 7,
        corrected: 3,
        resolved: 1,
        retried: 3,
        multiStepOutcomes: 5,
        firstOutcomeBreakdown: {
          verified: 7,
          corrected: 3,
          resolved: 1,
          retried: 2
        },
        latestOutcomeBreakdown: {
          verified: 7,
          corrected: 3,
          resolved: 1,
          retried: 3
        }
      });
      expect(response.body.totals.perTotal.linkedOutcomeRate).toBe(0.4667);
      expect(response.body.totals.perLinkedOutcome.correctedRate).toBe(0.2143);
      expect(response.body.totals.correctedRate).toBe(0.2143);
      expect(response.body.cohorts).toHaveLength(3);
      expect(response.body.cohorts[0]).toMatchObject({
        cohort: 'baseline',
        total: 20,
        linkedOutcomes: 8,
        multiStepOutcomes: 2,
        correctedRate: 0.25,
        firstOutcomeBreakdown: {
          verified: 2,
          corrected: 3,
          resolved: 1,
          retried: 1
        },
        latestOutcomeBreakdown: {
          verified: 3,
          corrected: 2,
          resolved: 1,
          retried: 2
        },
        perTotal: {
          linkedOutcomeRate: 0.4
        },
        perLinkedOutcome: {
          correctedRate: 0.25
        }
      });
      expect(response.body.cohorts[1]).toMatchObject({
        cohort: 'pass2_not_adopted',
        total: 0,
        linkedOutcomes: 0,
        correctedRate: 0
      });
      expect(response.body.cohorts[2]).toMatchObject({
        cohort: 'pass2_adopted',
        total: 10,
        linkedOutcomes: 6,
        multiStepOutcomes: 3,
        verifiedRate: 0.6667,
        firstOutcomeBreakdown: {
          verified: 5,
          corrected: 0,
          resolved: 0,
          retried: 1
        },
        perLinkedOutcome: {
          verifiedRate: 0.6667
        }
      });
    });

    test('clamps invalid days and returns 500 on query failure', async () => {
      db.query.mockRejectedValueOnce(new Error('db offline'));

      const response = await request(app)
        .get('/api/classification/second-pass-evaluation?days=bad');

      expect(response.status).toBe(500);
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [30]
      );
      expect(response.body.error).toBe('Failed to load second-pass evaluation stats');
    });
  });
});
