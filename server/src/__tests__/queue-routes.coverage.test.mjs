/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

import { createLoggerModuleMock } from './helpers/mockFactory.mjs';
const queueService = {
  getOllamaStatus: jest.fn(),
  getStats: jest.fn(),
  getGapAnalysisStats: jest.fn(),
  getPendingTasks: jest.fn(),
  getFailedTasks: jest.fn(),
  getLiveStats: jest.fn(),
  getEnrichmentRetryStats: jest.fn(),
  processEnrichmentRetryQueue: jest.fn(),
  backfillEnrichmentRetryQueue: jest.fn(),
  retryTask: jest.fn(),
  dismissFailedTask: jest.fn(),
  cancelTask: jest.fn(),
  manualClassifyTask: jest.fn(),
  clearCompletedTasks: jest.fn(),
  clearFailedTasks: jest.fn(),
  retryAllFailedTasks: jest.fn(),
  cancelAllPendingTasks: jest.fn(),
  reprocessCompleted: jest.fn(),
  clearAndResync: jest.fn(),
};

jest.unstable_mockModule('../middleware/apiKeyAuth.mjs', () => ({
  authenticateTokenOrApiKey: (req, res, next) => next(),
  requireReadWrite: (req, res, next) => next(),
}));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

jest.unstable_mockModule('../services/queueService.mjs', () => ({ queueService }));

const { router: queueRouter } = await import('../routes/queue.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

describe('Queue routes coverage', () => {
  let app;

  beforeEach(() => {
    jest.resetAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/queue', queueRouter);
    app.use(errorHandler);

    queueService.getStats.mockResolvedValue({ pending: 2, aiAvailable: true, workerRunning: true });
    queueService.getGapAnalysisStats.mockResolvedValue({ unprocessed: 3 });
    queueService.getLiveStats.mockResolvedValue({
      queue: { pending: 2, aiAvailable: true, workerRunning: true },
      gapAnalysis: { unprocessed: 3 },
      today: { classified: 4, avgConfidence: 83, allClassified: 9, allAvgConfidence: 78 },
      enrichment: {
        totalItems: 100,
        enriched: 45,
        tavilyEnriched: 30,
        omdbEnriched: 20,
        progress: 45,
        pending: 7,
        retryQueue: { tavily: { pending: 1 }, total: { pending: 1 } },
      },
      health: { ai: true, worker: true, database: true },
      timestamp: '2026-03-21T00:00:00.000Z',
    });
    queueService.getEnrichmentRetryStats.mockResolvedValue({ tavily: { pending: 1 }, total: { pending: 1 } });
  });

  test('GET /api/queue/ollama-status returns generation status', async () => {
    queueService.getOllamaStatus.mockReturnValue({
      isGenerating: true,
      model: 'gemma3',
      tokens: 123,
    });

    const res = await request(app)
      .get('/api/queue/ollama-status')
      .expect(200);

    expect(queueService.getOllamaStatus).toHaveBeenCalled();
    expect(res.body.isGenerating).toBe(true);
  });

  test('GET /api/queue/stats returns queue stats', async () => {
    const res = await request(app)
      .get('/api/queue/stats')
      .expect(200);

    expect(res.body.pending).toBe(2);
  });

  test('GET /api/queue/stats returns 500 on read failure', async () => {
    queueService.getStats.mockRejectedValueOnce(new Error('stats query failed'));

    const res = await request(app)
      .get('/api/queue/stats')
      .expect(500);

    expect(res.body.message).toContain('stats query failed');
  });

  test('GET /api/queue/gap-analysis-stats returns gap stats', async () => {
    const res = await request(app)
      .get('/api/queue/gap-analysis-stats')
      .expect(200);

    expect(res.body.unprocessed).toBe(3);
  });

  test('GET /api/queue/gap-analysis-stats returns 500 on read failure', async () => {
    queueService.getGapAnalysisStats.mockRejectedValueOnce(new Error('gap query failed'));

    const res = await request(app)
      .get('/api/queue/gap-analysis-stats')
      .expect(500);

    expect(res.body.message).toContain('gap query failed');
  });

  describe('GET /api/queue/live-stats', () => {
    test('returns computed live stats payload', async () => {
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
      queueService.getLiveStats.mockResolvedValueOnce({
        queue: { pending: 0, aiAvailable: true, workerRunning: true },
        gapAnalysis: { unprocessed: 0 },
        today: { classified: 0, avgConfidence: 0, allClassified: 0, allAvgConfidence: 0 },
        enrichment: {
          totalItems: 10,
          enriched: 0,
          tavilyEnriched: 0,
          omdbEnriched: 0,
          progress: 0,
          pending: 0,
          retryQueue: { tavily: { pending: 0 }, total: { pending: 0 } },
        },
        health: { ai: true, worker: true, database: true },
        timestamp: '2026-03-21T00:00:00.000Z',
      });

      const res = await request(app)
        .get('/api/queue/live-stats')
        .expect(200);

      expect(res.body.enrichment.retryQueue.total.pending).toBe(0);
    });

    test('returns 500 on main query failure', async () => {
      queueService.getLiveStats.mockRejectedValueOnce(new Error('today query failed'));

      const res = await request(app)
        .get('/api/queue/live-stats')
        .expect(500);

      expect(res.body.message).toContain('today query failed');
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

    test('returns 400 for invalid pending limit', async () => {
      const res = await request(app)
        .get('/api/queue/pending?limit=-1')
        .expect(400);

      expect(res.body.code).toBe('invalid_limit');
      expect(res.body.max).toBe(100);
      expect(queueService.getPendingTasks).not.toHaveBeenCalled();
    });

    test('returns 400 for invalid failed limit', async () => {
      const res = await request(app)
        .get('/api/queue/failed?limit=abc')
        .expect(400);

      expect(res.body.code).toBe('invalid_limit');
      expect(res.body.max).toBe(100);
      expect(queueService.getFailedTasks).not.toHaveBeenCalled();
    });

    test('returns 400 for out-of-range pending and failed limits', async () => {
      await request(app)
        .get('/api/queue/pending?limit=101')
        .expect(400);

      await request(app)
        .get('/api/queue/failed?limit=101')
        .expect(400);
    });

    test('returns 500 when pending or failed reads throw', async () => {
      queueService.getPendingTasks.mockRejectedValueOnce(new Error('pending query failed'));
      queueService.getFailedTasks.mockRejectedValueOnce(new Error('failed query failed'));

      const pendingRes = await request(app)
        .get('/api/queue/pending')
        .expect(500);

      const failedRes = await request(app)
        .get('/api/queue/failed')
        .expect(500);

      expect(pendingRes.body.message).toContain('pending query failed');
      expect(failedRes.body.message).toContain('failed query failed');
    });
  });

  describe('task action endpoints', () => {
    test('POST /task/:id/retry', async () => {
      queueService.retryTask.mockResolvedValueOnce({ success: true });

      const res = await request(app)
        .post('/api/queue/task/22/retry')
        .expect(200);

      expect(queueService.retryTask).toHaveBeenCalledWith(22);
      expect(res.body.success).toBe(true);
    });

    test('POST /task/:id/dismiss', async () => {
      queueService.dismissFailedTask.mockResolvedValueOnce({ success: true });

      await request(app)
        .post('/api/queue/task/22/dismiss')
        .expect(200);

      expect(queueService.dismissFailedTask).toHaveBeenCalledWith(22);
    });

    test('POST /task/:id/cancel', async () => {
      queueService.cancelTask.mockResolvedValueOnce({ success: true });

      await request(app)
        .post('/api/queue/task/22/cancel')
        .expect(200);

      expect(queueService.cancelTask).toHaveBeenCalledWith(22);
    });

    test('returns 400 for invalid task ids on task action endpoints', async () => {
      await request(app)
        .post('/api/queue/task/not-a-number/retry')
        .expect(400);

      await request(app)
        .post('/api/queue/task/0/cancel')
        .expect(400);
    });
  });

  describe('bulk queue action endpoints', () => {
    test('POST /clear-completed', async () => {
      queueService.clearCompletedTasks.mockResolvedValueOnce({ success: true, count: 3 });

      const res = await request(app)
        .post('/api/queue/clear-completed')
        .expect(200);

      expect(res.body.count).toBe(3);
    });

    test('POST /clear-failed', async () => {
      queueService.clearFailedTasks.mockResolvedValueOnce({ success: true, count: 2 });

      const res = await request(app)
        .post('/api/queue/clear-failed')
        .expect(200);

      expect(res.body.count).toBe(2);
    });

    test('POST /retry-all-failed', async () => {
      queueService.retryAllFailedTasks.mockResolvedValueOnce({ success: true, count: 8 });

      const res = await request(app)
        .post('/api/queue/retry-all-failed')
        .expect(200);

      expect(res.body.count).toBe(8);
    });

    test('POST /cancel-all-pending', async () => {
      queueService.cancelAllPendingTasks.mockResolvedValueOnce({ success: true, count: 6 });

      const res = await request(app)
        .post('/api/queue/cancel-all-pending')
        .expect(200);

      expect(res.body.count).toBe(6);
    });

    test('bulk queue actions return 500 for structured backend failures', async () => {
      queueService.clearFailedTasks.mockResolvedValueOnce({
        success: false,
        code: 'bulk_action_failed',
        action: 'clear_failed',
      });

      const res = await request(app)
        .post('/api/queue/clear-failed')
        .expect(500);

      expect(res.body).toEqual({
        error: 'Queue bulk action failed',
        code: 'bulk_action_failed',
        action: 'clear_failed',
      });
    });

    test('POST /reprocess-completed', async () => {
      queueService.reprocessCompleted.mockResolvedValueOnce({ success: true, count: 4 });

      const res = await request(app)
        .post('/api/queue/reprocess-completed')
        .expect(200);

      expect(res.body.count).toBe(4);
    });

    test('POST /clear-and-resync', async () => {
      queueService.clearAndResync.mockResolvedValueOnce({ success: true, cleared: 12, queuedLibraries: 2 });

      const res = await request(app)
        .post('/api/queue/clear-and-resync')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.cleared).toBe(12);
    });

    test('POST /reprocess-completed returns 500 for structured backend failures', async () => {
      queueService.reprocessCompleted.mockResolvedValueOnce({
        success: false,
        code: 'bulk_action_failed',
        action: 'reprocess_completed',
      });

      const res = await request(app)
        .post('/api/queue/reprocess-completed')
        .expect(500);

      expect(res.body).toEqual({
        error: 'Queue bulk action failed',
        code: 'bulk_action_failed',
        action: 'reprocess_completed',
      });
    });
  });

  describe('POST /api/queue/tasks/:id/classify', () => {
    test('validates required library_id', async () => {
      await request(app)
        .post('/api/queue/tasks/3/classify')
        .send({})
        .expect(400);
    });

    test('returns 400 for invalid task id', async () => {
      await request(app)
        .post('/api/queue/tasks/not-a-number/classify')
        .send({ library_id: 4 })
        .expect(400);
    });

    test('returns 404 when task not found', async () => {
      queueService.manualClassifyTask.mockResolvedValueOnce({ success: false, code: 'task_not_found' });

      await request(app)
        .post('/api/queue/tasks/3/classify')
        .send({ library_id: 4 })
        .expect(404);
    });

    test('returns 404 when library not found', async () => {
      queueService.manualClassifyTask.mockResolvedValueOnce({ success: false, code: 'library_not_found' });

      await request(app)
        .post('/api/queue/tasks/3/classify')
        .send({ library_id: 4 })
        .expect(404);
    });

    test('returns 409 for invalid task state', async () => {
      queueService.manualClassifyTask.mockResolvedValueOnce({ success: false, code: 'invalid_state', currentStatus: 'processing' });

      const res = await request(app)
        .post('/api/queue/tasks/3/classify')
        .send({ library_id: 4 })
        .expect(409);

      expect(res.body.code).toBe('invalid_state');
      expect(res.body.currentStatus).toBe('processing');
    });

    test('returns 409 for invalid task type', async () => {
      queueService.manualClassifyTask.mockResolvedValueOnce({ success: false, code: 'invalid_task_type', taskType: 'metadata_enrichment' });

      const res = await request(app)
        .post('/api/queue/tasks/3/classify')
        .send({ library_id: 4 })
        .expect(409);

      expect(res.body.code).toBe('invalid_task_type');
      expect(res.body.taskType).toBe('metadata_enrichment');
    });

    test('manually classifies task through queue service', async () => {
      queueService.manualClassifyTask.mockResolvedValueOnce({
        success: true,
        classificationId: 6606,
        libraryId: 4,
        libraryName: 'Family',
        message: 'Classified "Hoppers" to Family',
      });

      const res = await request(app)
        .post('/api/queue/tasks/3/classify')
        .send({ library_id: 4, resolved_by: 'admin-user' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.classificationId).toBe(6606);
      expect(queueService.manualClassifyTask).toHaveBeenCalledWith(3, 4, 'admin-user');
    });

    test('handles classify route errors', async () => {
      queueService.manualClassifyTask.mockRejectedValueOnce(new Error('classify insert failed'));

      const res = await request(app)
        .post('/api/queue/tasks/3/classify')
        .send({ library_id: 4 })
        .expect(500);

      expect(res.body.message).toContain('classify insert failed');
    });
  });

  describe('retry queue endpoints', () => {
    test('GET /retry-stats', async () => {
      queueService.getEnrichmentRetryStats.mockResolvedValueOnce({ tavily: { pending: 2 } });

      const res = await request(app)
        .get('/api/queue/retry-stats')
        .expect(200);

      expect(res.body.tavily.pending).toBe(2);
    });

    test('POST /retry-process', async () => {
      queueService.processEnrichmentRetryQueue.mockResolvedValueOnce({ processed: 5, failed: 1 });

      const res = await request(app)
        .post('/api/queue/retry-process')
        .send({ limit: 25, enrichmentType: 'tavily' })
        .expect(200);

      expect(queueService.processEnrichmentRetryQueue).toHaveBeenCalledWith(25, 'tavily');
      expect(res.body.processed).toBe(5);
    });

    test('POST /retry-process uses defaults when body is omitted', async () => {
      queueService.processEnrichmentRetryQueue.mockResolvedValueOnce({ processed: 1, failed: 0 });

      await request(app)
        .post('/api/queue/retry-process')
        .send({})
        .expect(200);

      expect(queueService.processEnrichmentRetryQueue).toHaveBeenCalledWith(50, 'tavily');
    });

    test('POST /retry-process rejects invalid limit', async () => {
      const res = await request(app)
        .post('/api/queue/retry-process')
        .send({ limit: 0, enrichmentType: 'tavily' })
        .expect(400);

      expect(res.body.code).toBe('invalid_limit');
      expect(res.body.max).toBe(200);
      expect(queueService.processEnrichmentRetryQueue).not.toHaveBeenCalled();
    });

    test('POST /retry-process rejects out-of-range limit', async () => {
      const res = await request(app)
        .post('/api/queue/retry-process')
        .send({ limit: 201, enrichmentType: 'tavily' })
        .expect(400);

      expect(res.body.code).toBe('invalid_limit');
      expect(res.body.max).toBe(200);
      expect(queueService.processEnrichmentRetryQueue).not.toHaveBeenCalled();
    });

    test('POST /retry-process rejects invalid enrichmentType', async () => {
      const res = await request(app)
        .post('/api/queue/retry-process')
        .send({ limit: 5, enrichmentType: 'bad-type' })
        .expect(400);

      expect(res.body.code).toBe('invalid_enrichment_type');
      expect(res.body.allowed).toEqual(['tavily', 'omdb']);
      expect(queueService.processEnrichmentRetryQueue).not.toHaveBeenCalled();
    });

    test('POST /retry-process rejects tmdb until a real TMDB retry processor exists', async () => {
      const res = await request(app)
        .post('/api/queue/retry-process')
        .send({ limit: 5, enrichmentType: 'tmdb' })
        .expect(400);

      expect(res.body.code).toBe('invalid_enrichment_type');
      expect(res.body.allowed).toEqual(['tavily', 'omdb']);
      expect(queueService.processEnrichmentRetryQueue).not.toHaveBeenCalled();
    });

    test('POST /retry-backfill', async () => {
      queueService.backfillEnrichmentRetryQueue.mockResolvedValueOnce({
        success: true,
        queued: 13,
        enrichmentType: 'tavily',
        reason: 'items_missing_omdb_data',
      });

      const res = await request(app)
        .post('/api/queue/retry-backfill')
        .expect(200);

      expect(res.body.queued).toBe(13);
      expect(res.body.enrichmentType).toBe('tavily');
    });
  });
});
