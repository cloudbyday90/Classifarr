/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const request = require('supertest');
const express = require('express');

jest.mock('../middleware/apiKeyAuth', () => ({
  authenticateTokenOrApiKey: (req, res, next) => next(),
  requireReadWrite: (req, res, next) => next()
}));

jest.mock('../config/database', () => ({
  query: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('../services/queueService', () => ({
  getStats: jest.fn(),
  getGapAnalysisStats: jest.fn(),
  getPendingTasks: jest.fn(),
  getFailedTasks: jest.fn(),
  retryTask: jest.fn(),
  dismissFailedTask: jest.fn(),
  cancelTask: jest.fn(),
  clearCompletedTasks: jest.fn(),
  clearFailedTasks: jest.fn(),
  retryAllFailedTasks: jest.fn(),
  cancelAllPendingTasks: jest.fn(),
  reprocessCompleted: jest.fn(),
  clearAndResync: jest.fn()
}));

jest.mock('../services/ollama', () => ({
  getGenerationStatus: jest.fn()
}));

jest.mock('../services/enrichmentRetryService', () => ({
  getStats: jest.fn(),
  processRetryQueue: jest.fn(),
  backfillRetryQueue: jest.fn()
}));

jest.mock('../services/classification', () => ({
  routeToArr: jest.fn()
}));

const db = require('../config/database');
const queueService = require('../services/queueService');
const ollamaService = require('../services/ollama');
const enrichmentRetryService = require('../services/enrichmentRetryService');
const classificationService = require('../services/classification');
const queueRouter = require('../routes/queue');

describe('Queue routes coverage', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/queue', queueRouter);

    queueService.getStats.mockResolvedValue({ pending: 2, aiAvailable: true, workerRunning: true });
    queueService.getGapAnalysisStats.mockResolvedValue({ unprocessed: 3 });
    enrichmentRetryService.getStats.mockResolvedValue({ tavily: { pending: 1 }, total: { pending: 1 } });
  });

  test('GET /api/queue/ollama-status returns generation status', async () => {
    ollamaService.getGenerationStatus.mockReturnValue({
      isGenerating: true,
      model: 'gemma3',
      tokens: 123
    });

    const res = await request(app)
      .get('/api/queue/ollama-status')
      .expect(200);

    expect(res.body.isGenerating).toBe(true);
  });

  test('GET /api/queue/stats returns queue stats', async () => {
    const res = await request(app)
      .get('/api/queue/stats')
      .expect(200);

    expect(res.body.pending).toBe(2);
  });

  test('GET /api/queue/gap-analysis-stats returns gap stats', async () => {
    const res = await request(app)
      .get('/api/queue/gap-analysis-stats')
      .expect(200);

    expect(res.body.unprocessed).toBe(3);
  });

  describe('GET /api/queue/live-stats', () => {
    test('returns computed live stats payload', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            new_classified: '4',
            all_classified: '9',
            new_avg_confidence: '82.6',
            all_avg_confidence: '78.4'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            total_items: '100',
            enriched: '45',
            tavily_enriched: '30',
            omdb_enriched: '20'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{ pending: '7' }]
        });

      const res = await request(app)
        .get('/api/queue/live-stats')
        .expect(200);

      expect(res.body.queue.pending).toBe(2);
      expect(res.body.today.classified).toBe(4);
      expect(res.body.today.avgConfidence).toBe(83);
      expect(res.body.enrichment.progress).toBe(45);
      expect(res.body.enrichment.pending).toBe(7);
      expect(res.body.health.ai).toBe(true);
      expect(res.body).toHaveProperty('timestamp');
    });

    test('continues when retry queue stats throws', async () => {
      enrichmentRetryService.getStats.mockRejectedValueOnce(new Error('retry stats unavailable'));
      db.query
        .mockResolvedValueOnce({
          rows: [{ new_classified: '0', all_classified: '0', new_avg_confidence: null, all_avg_confidence: null }]
        })
        .mockResolvedValueOnce({
          rows: [{ total_items: '10', enriched: '0', tavily_enriched: '0', omdb_enriched: '0' }]
        })
        .mockResolvedValueOnce({
          rows: [{ pending: '0' }]
        });

      const res = await request(app)
        .get('/api/queue/live-stats')
        .expect(200);

      expect(res.body.enrichment.retryQueue.total.pending).toBe(0);
    });

    test('returns 500 on main query failure', async () => {
      db.query.mockRejectedValueOnce(new Error('today query failed'));

      const res = await request(app)
        .get('/api/queue/live-stats')
        .expect(500);

      expect(res.body.error).toContain('today query failed');
    });
  });

  describe('GET /api/queue/pending and /failed', () => {
    test('uses query limit for pending tasks', async () => {
      queueService.getPendingTasks.mockResolvedValueOnce([{ id: 1 }]);

      await request(app)
        .get('/api/queue/pending?limit=5')
        .expect(200);

      expect(queueService.getPendingTasks).toHaveBeenCalledWith(5);
    });

    test('uses default limit for failed tasks', async () => {
      queueService.getFailedTasks.mockResolvedValueOnce([{ id: 9 }]);

      await request(app)
        .get('/api/queue/failed')
        .expect(200);

      expect(queueService.getFailedTasks).toHaveBeenCalledWith(20);
    });
  });

  describe('task action endpoints', () => {
    test('POST /task/:id/retry', async () => {
      queueService.retryTask.mockResolvedValueOnce(true);

      const res = await request(app)
        .post('/api/queue/task/22/retry')
        .expect(200);

      expect(queueService.retryTask).toHaveBeenCalledWith(22);
      expect(res.body.success).toBe(true);
    });

    test('POST /task/:id/dismiss', async () => {
      queueService.dismissFailedTask.mockResolvedValueOnce(true);

      await request(app)
        .post('/api/queue/task/22/dismiss')
        .expect(200);

      expect(queueService.dismissFailedTask).toHaveBeenCalledWith(22);
    });

    test('POST /task/:id/cancel', async () => {
      queueService.cancelTask.mockResolvedValueOnce(true);

      await request(app)
        .post('/api/queue/task/22/cancel')
        .expect(200);

      expect(queueService.cancelTask).toHaveBeenCalledWith(22);
    });
  });

  describe('bulk queue action endpoints', () => {
    test('POST /clear-completed', async () => {
      queueService.clearCompletedTasks.mockResolvedValueOnce(3);

      const res = await request(app)
        .post('/api/queue/clear-completed')
        .expect(200);

      expect(res.body.count).toBe(3);
    });

    test('POST /clear-failed', async () => {
      queueService.clearFailedTasks.mockResolvedValueOnce(2);

      const res = await request(app)
        .post('/api/queue/clear-failed')
        .expect(200);

      expect(res.body.count).toBe(2);
    });

    test('POST /retry-all-failed', async () => {
      queueService.retryAllFailedTasks.mockResolvedValueOnce(8);

      const res = await request(app)
        .post('/api/queue/retry-all-failed')
        .expect(200);

      expect(res.body.count).toBe(8);
    });

    test('POST /cancel-all-pending', async () => {
      queueService.cancelAllPendingTasks.mockResolvedValueOnce(6);

      const res = await request(app)
        .post('/api/queue/cancel-all-pending')
        .expect(200);

      expect(res.body.count).toBe(6);
    });

    test('POST /reprocess-completed', async () => {
      queueService.reprocessCompleted.mockResolvedValueOnce(4);

      const res = await request(app)
        .post('/api/queue/reprocess-completed')
        .expect(200);

      expect(res.body.count).toBe(4);
    });

    test('POST /clear-and-resync', async () => {
      queueService.clearAndResync.mockResolvedValueOnce({ cleared: 12, queuedLibraries: 2 });

      const res = await request(app)
        .post('/api/queue/clear-and-resync')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.cleared).toBe(12);
    });
  });

  describe('POST /api/queue/tasks/:id/classify', () => {
    test('validates required library_id', async () => {
      await request(app)
        .post('/api/queue/tasks/3/classify')
        .send({})
        .expect(400);
    });

    test('returns 404 when task not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post('/api/queue/tasks/3/classify')
        .send({ library_id: 4 })
        .expect(404);
    });

    test('returns 404 when library not found', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 3, payload: { title: 'Unknown', media_type: 'movie' } }]
        })
        .mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post('/api/queue/tasks/3/classify')
        .send({ library_id: 4 })
        .expect(404);
    });

    test('manually classifies task, routes to arr, and stores learning pattern', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 3,
            payload: JSON.stringify({
              media: { title: 'Hoppers', year: 2026, tmdb_id: 1327819, media_type: 'movie' }
            })
          }]
        }) // select task
        .mockResolvedValueOnce({
          rows: [{ id: 4, name: 'Family', media_type: 'movie' }]
        }) // select library
        .mockResolvedValueOnce({
          rows: [{ id: 6606 }]
        }) // insert classification_history
        .mockResolvedValueOnce({}) // update task_queue
        .mockResolvedValueOnce({}); // insert learning_patterns

      classificationService.routeToArr.mockResolvedValueOnce();

      const res = await request(app)
        .post('/api/queue/tasks/3/classify')
        .send({ library_id: 4, resolved_by: 'admin-user' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.classificationId).toBe(6606);
      expect(classificationService.routeToArr).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Hoppers', tmdb_id: 1327819 }),
        expect.objectContaining({ id: 4, name: 'Family' })
      );
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO learning_patterns'),
        expect.arrayContaining([1327819, 'movie', 4])
      );
    });

    test('handles classify route errors', async () => {
      db.query.mockRejectedValueOnce(new Error('classify insert failed'));

      const res = await request(app)
        .post('/api/queue/tasks/3/classify')
        .send({ library_id: 4 })
        .expect(500);

      expect(res.body.error).toContain('classify insert failed');
    });
  });

  describe('retry queue endpoints', () => {
    test('GET /retry-stats', async () => {
      enrichmentRetryService.getStats.mockResolvedValueOnce({ tavily: { pending: 2 } });

      const res = await request(app)
        .get('/api/queue/retry-stats')
        .expect(200);

      expect(res.body.tavily.pending).toBe(2);
    });

    test('POST /retry-process', async () => {
      enrichmentRetryService.processRetryQueue.mockResolvedValueOnce({ processed: 5, failed: 1 });

      const res = await request(app)
        .post('/api/queue/retry-process')
        .send({ limit: 25, enrichmentType: 'tavily' })
        .expect(200);

      expect(enrichmentRetryService.processRetryQueue).toHaveBeenCalledWith(25, 'tavily');
      expect(res.body.processed).toBe(5);
    });

    test('POST /retry-backfill', async () => {
      enrichmentRetryService.backfillRetryQueue.mockResolvedValueOnce({ queued: 13 });

      const res = await request(app)
        .post('/api/queue/retry-backfill')
        .expect(200);

      expect(res.body.queued).toBe(13);
    });
  });
});

