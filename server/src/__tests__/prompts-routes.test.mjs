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

import request from 'supertest';
import { jest } from '@jest/globals';
import { createLoggerModuleMock, createMountedTestApp, createStandardDbMock } from './helpers/setupRouteTest.mjs';
import { createNamedServiceStub } from './helpers/mockFactory.mjs';

const query = jest.fn();
const {
  service: promptBuilder,
  module: promptBuilderModule,
} = createNamedServiceStub('promptBuilder', ['buildPrompt', 'buildBatchSummary']);
const { buildPrompt, buildBatchSummary } = promptBuilder;
const {
  service: feedbackAnalysis,
  module: feedbackAnalysisModule,
} = createNamedServiceStub('feedbackAnalysis', ['recordFeedback']);
const { recordFeedback } = feedbackAnalysis;

jest.unstable_mockModule('../config/database.mjs', () => createStandardDbMock(query));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

jest.unstable_mockModule('../services/promptBuilder.mjs', () => promptBuilderModule);

jest.unstable_mockModule('../services/feedbackAnalysis.mjs', () => feedbackAnalysisModule);

const { router: promptsRouter } = await import('../routes/prompts.mjs');

describe('Prompts API Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createMountedTestApp({
      basePath: '/api/prompts',
      router: promptsRouter,
    });
  });

  describe('GET /api/prompts/pending', () => {
    test('should return pending prompts with pagination', async () => {
      const mockPrompts = [
        {
          id: 1,
          tmdb_id: 603,
          media_type: 'movie',
          title: 'The Matrix',
          year: 1999,
          metadata: '{}',
          confidence: 65,
          pending_reason: 'low_confidence',
          created_at: '2023-12-01T10:00:00Z',
          classification_method: 'policy',
        },
      ];

      query
        .mockResolvedValueOnce({ rows: mockPrompts })
        .mockResolvedValueOnce({ rows: [{ total: '5' }] });

      const response = await request(app)
        .get('/api/prompts/pending')
        .query({ limit: 10, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.pagination.total).toBe(5);
      expect(response.body.data.pagination.limit).toBe(10);
      expect(response.body.data.pagination.offset).toBe(0);
    });

    test('should validate limit parameter within bounds', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });

      const response = await request(app)
        .get('/api/prompts/pending')
        .query({ limit: 200, offset: 0 });

      expect(response.status).toBe(200);
      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10, 0])
      );
    });

    test('should handle invalid limit gracefully', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });

      const response = await request(app)
        .get('/api/prompts/pending')
        .query({ limit: 'invalid', offset: 0 });

      expect(response.status).toBe(200);
      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10, 0])
      );
    });

    test('should handle database errors', async () => {
      query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/prompts/pending');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to retrieve');
    });
  });

  describe('GET /api/prompts/batch', () => {
    test('should return batch summary', async () => {
      const mockItems = [
        {
          id: 1,
          tmdb_id: 603,
          media_type: 'movie',
          title: 'The Matrix',
          year: 1999,
          metadata: '{}',
          confidence: 85,
          classification_result: '{"ranked":[]}',
          created_at: '2023-12-01T10:00:00Z',
        },
      ];

      const mockSummary = {
        type: 'batch_summary',
        totalItems: 1,
        grouped: {
          highConfidence: [mockItems[0]],
          lowConfidence: [],
          closeRace: [],
          newDiscovery: [],
        },
        summary: {
          highConfidence: 1,
          lowConfidence: 0,
          closeRace: 0,
          newDiscovery: 0,
        },
      };

      query.mockResolvedValueOnce({ rows: mockItems });
      buildBatchSummary.mockReturnValue(mockSummary);

      const response = await request(app)
        .get('/api/prompts/batch');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('batch_summary');
      expect(response.body.data.totalItems).toBe(1);
      expect(buildBatchSummary).toHaveBeenCalled();
    });

    test('should validate limit parameter', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      buildBatchSummary.mockReturnValue({
        type: 'batch_summary',
        totalItems: 0,
        grouped: {},
        summary: {},
      });

      const response = await request(app)
        .get('/api/prompts/batch')
        .query({ limit: 150 });

      expect(response.status).toBe(200);
      expect(query).toHaveBeenCalledWith(expect.any(String), [50]);
    });
  });

  describe('GET /api/prompts/:id', () => {
    test('should return prompt details with rich context', async () => {
      const mockClassification = {
        id: 1,
        tmdb_id: 603,
        media_type: 'movie',
        title: 'The Matrix',
        year: 1999,
        metadata: '{"genres":["Action","Sci-Fi"]}',
        confidence: 65,
        pending_reason: 'low_confidence',
        created_at: '2023-12-01T10:00:00Z',
        classification_method: 'policy',
        classification_result: '{"ranked":[]}',
      };

      const mockPrompt = {
        type: 'low_confidence',
        title: 'The Matrix (1999)',
        confidence: 65,
      };

      query.mockResolvedValueOnce({ rows: [mockClassification] });
      buildPrompt.mockResolvedValue(mockPrompt);

      const response = await request(app)
        .get('/api/prompts/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(1);
      expect(response.body.data.prompt).toEqual(mockPrompt);
      expect(buildPrompt).toHaveBeenCalled();
    });

    test('should validate id parameter', async () => {
      const response = await request(app)
        .get('/api/prompts/invalid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid prompt ID');
    });

    test('should return 404 for non-existent prompt', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/prompts/999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /api/prompts/:id/respond', () => {
    test('should submit prompt response successfully', async () => {
      const mockClassification = {
        id: 1,
        tmdb_id: 603,
        media_type: 'movie',
        title: 'The Matrix',
        metadata: '{"genres":["Action"]}',
        classification_result: '{"ranked":[{"library_id":1,"score":65}]}',
        created_at: '2023-12-01T10:00:00Z',
      };

      query
        .mockResolvedValueOnce({ rows: [mockClassification] })
        .mockResolvedValueOnce({ rows: [] });

      recordFeedback.mockResolvedValue(123);

      const response = await request(app)
        .post('/api/prompts/1/respond')
        .send({
          selectedLibraryId: 1,
          selectedPolicyId: 10,
          reasons: ['genre_based'],
          customReason: 'Perfect match',
          patternActions: [],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.feedbackId).toBe(123);
      expect(recordFeedback).toHaveBeenCalled();
    });

    test('should validate required selectedLibraryId', async () => {
      const response = await request(app)
        .post('/api/prompts/1/respond')
        .send({
          reasons: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('selectedLibraryId is required');
    });

    test('should validate id parameter', async () => {
      const response = await request(app)
        .post('/api/prompts/invalid/respond')
        .send({
          selectedLibraryId: 1,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid prompt ID');
    });

    test('should create pattern actions when provided', async () => {
      const mockClassification = {
        id: 1,
        tmdb_id: 603,
        media_type: 'movie',
        title: 'The Matrix',
        metadata: '{}',
        classification_result: '{"ranked":[]}',
        created_at: '2023-12-01T10:00:00Z',
      };

      query
        .mockResolvedValueOnce({ rows: [mockClassification] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      recordFeedback.mockResolvedValue(123);

      const response = await request(app)
        .post('/api/prompts/1/respond')
        .send({
          selectedLibraryId: 1,
          patternActions: [
            {
              type: 'studio',
              value: 'Warner Bros',
              targetLibraryId: 1,
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.patternsCreated).toBe(1);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO discovered_patterns'),
        expect.arrayContaining(['studio', 'Warner Bros', 1, 75])
      );
    });

    test('should skip invalid pattern actions but still succeed', async () => {
      const mockClassification = {
        id: 1,
        tmdb_id: 603,
        media_type: 'movie',
        title: 'The Matrix',
        metadata: '{}',
        classification_result: '{"ranked":[]}',
        created_at: '2023-12-01T10:00:00Z',
      };

      query
        .mockResolvedValueOnce({ rows: [mockClassification] })
        .mockResolvedValueOnce({ rows: [] });

      recordFeedback.mockResolvedValue(123);

      const response = await request(app)
        .post('/api/prompts/1/respond')
        .send({
          selectedLibraryId: 1,
          patternActions: [
            {
              targetLibraryId: 1,
            },
            {
              type: 'studio',
              value: 'Valid Studio',
              targetLibraryId: 1,
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.patternsCreated).toBe(2);
    });
  });
});
