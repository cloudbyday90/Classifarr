/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import request from 'supertest';
import { jest } from '@jest/globals';
import { createStandardDbMock, loggerMockFactory, createTestApp } from './helpers/setupRouteTest.mjs';

const search = jest.fn();
const getMovieDetails = jest.fn();
const getTVDetails = jest.fn();
const enqueue = jest.fn();
const query = jest.fn();

jest.unstable_mockModule('../services/tmdb.mjs', () => ({
  default: {
    search,
    getMovieDetails,
    getTVDetails,
  },
}));

jest.unstable_mockModule('../services/queueService.mjs', () => ({
  default: {
    enqueue,
  },
}));

jest.unstable_mockModule('../config/database.mjs', () => createStandardDbMock(query));

jest.unstable_mockModule('../utils/logger.mjs', loggerMockFactory);

const { default: requestsRouter } = await import('../routes/requests.mjs');

describe('Requests Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
    app.use('/requests', requestsRouter);
  });

  describe('GET /requests/search', () => {
    it('rejects short queries', async () => {
      const res = await request(app)
        .get('/requests/search')
        .query({ q: 'a' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Query must be at least 2 characters');
    });

    it('searches TMDB with trimmed query text', async () => {
      search.mockResolvedValueOnce([{ id: 603, title: 'The Matrix' }]);

      const res = await request(app)
        .get('/requests/search')
        .query({ q: '  matrix  ', type: 'movie' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 603, title: 'The Matrix' }]);
      expect(search).toHaveBeenCalledWith('matrix', 'movie');
    });
  });

  describe('POST /requests/submit', () => {
    it('validates required fields', async () => {
      const res = await request(app)
        .post('/requests/submit')
        .send({ tmdbId: 603 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('tmdbId and mediaType are required');
    });

    it('validates media type', async () => {
      const res = await request(app)
        .post('/requests/submit')
        .send({ tmdbId: 603, mediaType: 'anime' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('mediaType must be movie or tv');
    });

    it('submits a movie request and enqueues classification', async () => {
      getMovieDetails.mockResolvedValueOnce({
        title: 'The Matrix',
        external_ids: { tvdb_id: 12345 },
      });
      query.mockResolvedValueOnce({ rows: [{ id: 77 }] });
      enqueue.mockResolvedValueOnce('task-123');

      const res = await request(app)
        .post('/requests/submit')
        .send({ tmdbId: 603, mediaType: 'movie' });

      expect(res.status).toBe(202);
      expect(res.body).toMatchObject({
        success: true,
        queued: true,
        taskId: 'task-123',
        logId: 77,
        title: 'The Matrix',
      });
      expect(enqueue).toHaveBeenCalledWith(
        'classification',
        expect.objectContaining({
          notification_type: 'MANUAL_REQUEST',
          subject: 'The Matrix',
        }),
        expect.objectContaining({
          webhookLogId: 77,
          source: 'manual',
          priority: 2,
        })
      );
    });
  });

  describe('GET /requests/recent', () => {
    it('returns recent manual requests', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 1, media_title: 'The Matrix', media_type: 'movie' }],
      });

      const res = await request(app)
        .get('/requests/recent')
        .query({ limit: 5 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 1, media_title: 'The Matrix', media_type: 'movie' }]);
      expect(query).toHaveBeenCalledWith(expect.any(String), [5]);
    });
  });
});
