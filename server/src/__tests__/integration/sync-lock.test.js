/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const request = require('supertest');
const express = require('express');

let syncRouter;
let mediaSyncRouter;
let queueRouter;

// Mock dependencies before requiring routes
jest.mock('../../config/database', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('../../services/mediaSync', () => ({
  syncLibrary: jest.fn(),
  syncAllLibraries: jest.fn()
}));

jest.mock('../../services/scheduler', () => ({
  runGapAnalysis: jest.fn()
}));

// Mock auth middleware to bypass authentication in tests
jest.mock('../../middleware/apiKeyAuth', () => ({
  authenticateTokenOrApiKey: (req, res, next) => next(),
  requireReadWrite: (req, res, next) => next()
}));

const syncStatus = require('../../services/syncStatus');
const queueService = require('../../services/queueService');
const mediaSyncService = require('../../services/mediaSync');
const db = require('../../config/database');

describe('Sync Lock Integration Tests', () => {
  let app;

  beforeAll(async () => {
    ({ default: syncRouter } = await import('../../routes/sync.mjs'));
    ({ default: mediaSyncRouter } = await import('../../routes/mediaSync.mjs'));
    ({ default: queueRouter } = await import('../../routes/queue.mjs'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/sync', syncRouter);
    app.use('/api/media-sync', mediaSyncRouter);
    app.use('/api/queue', queueRouter);
    // Reset sync status using the centralized reset method
    syncStatus.reset();

    // Mock queueService
    queueService.running = false;
    queueService.stopWorker = jest.fn();
    queueService.startWorker = jest.fn();
    queueService.omdbLimitHit = false;

    // Default mock implementations
    mediaSyncService.syncLibrary.mockResolvedValue({ success: true });
    mediaSyncService.syncAllLibraries.mockResolvedValue();
    mediaSyncRouter.mediaSyncService = mediaSyncService;
  });

  describe('GET /api/sync/status', () => {
    it('should return idle status when no sync is running', async () => {
      const response = await request(app)
        .get('/api/sync/status')
        .expect(200);

      expect(response.body.isRunning).toBe(false);
      expect(response.body.type).toBe(null);
      expect(response.body.progress).toBe(0);
    });

    it('should return active sync status', async () => {
      syncStatus.start('library_sync');
      syncStatus.updateProgress(50, 'Movies');

      const response = await request(app)
        .get('/api/sync/status')
        .expect(200);

      expect(response.body.isRunning).toBe(true);
      expect(response.body.type).toBe('library_sync');
      expect(response.body.progress).toBe(50);
      expect(response.body.currentLibrary).toBe('Movies');
      expect(response.body.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('POST /api/media-sync/sync/:libraryId', () => {
    it('should start library sync when no sync is running', async () => {
      const response = await request(app)
        .post('/api/media-sync/sync/1')
        .send({ incremental: false })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mediaSyncService.syncLibrary).toHaveBeenCalledWith(1, {
        incremental: false,
        batchSize: 100
      });
      expect(syncStatus.isRunning).toBe(false); // Should be stopped after completion
    });

    it('should return 409 when sync is already running', async () => {
      syncStatus.start('library_sync');
      syncStatus.updateProgress(30);

      const response = await request(app)
        .post('/api/media-sync/sync/2')
        .send({ incremental: false })
        .expect(409);

      expect(response.body.error).toBe('Sync already in progress');
      expect(response.body.message).toContain('library_sync is currently running');
      expect(response.body.progress).toBe(30);
      expect(mediaSyncService.syncLibrary).not.toHaveBeenCalled();
    });

    it('should stop sync on error', async () => {
      mediaSyncService.syncLibrary.mockRejectedValue(new Error('Sync failed'));

      await request(app)
        .post('/api/media-sync/sync/1')
        .send({ incremental: false })
        .expect(500);

      expect(syncStatus.isRunning).toBe(false); // Should be stopped after error
    });

    it('should prevent TOCTOU race condition with concurrent requests', async () => {
      // Mock sync to take some time so both requests can arrive "simultaneously"
      mediaSyncService.syncLibrary.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve({ success: true }), 100);
        });
      });

      // Fire two requests concurrently (without awaiting)
      const request1Promise = request(app)
        .post('/api/media-sync/sync/1')
        .send({ incremental: false });

      const request2Promise = request(app)
        .post('/api/media-sync/sync/2')
        .send({ incremental: false });

      // Wait for both to complete
      const [response1, response2] = await Promise.all([request1Promise, request2Promise]);

      // One should succeed (200), one should fail (409)
      const responses = [response1, response2];
      const successCount = responses.filter(r => r.status === 200).length;
      const blockedCount = responses.filter(r => r.status === 409).length;

      expect(successCount).toBe(1);
      expect(blockedCount).toBe(1);

      // Verify the blocked request got appropriate error message
      const blockedResponse = responses.find(r => r.status === 409);
      expect(blockedResponse.body.error).toBe('Sync already in progress');
      expect(blockedResponse.body.message).toContain('library_sync is currently running');

      // Verify the successful request actually called the service
      expect(mediaSyncService.syncLibrary).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/queue/clear-and-resync', () => {
    beforeEach(() => {
      // Mock database queries
      db.query.mockImplementation((query) => {
        if (query.includes('DELETE')) {
          return Promise.resolve({ rowCount: 0, rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });
    });

    it('should allow CARSA to start when no sync is running', async () => {
      const response = await request(app)
        .post('/api/queue/clear-and-resync')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should interrupt active library sync and start CARSA', async () => {
      syncStatus.start('library_sync');
      syncStatus.updateProgress(50, 'Movies');

      const response = await request(app)
        .post('/api/queue/clear-and-resync')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should allow CARSA to start even when another CARSA is running', async () => {
      // Start a first CARSA
      syncStatus.start('full_resync', false);
      syncStatus.updateProgress(25);

      // Trigger second CARSA - should force-stop first one and start new one
      const response = await request(app)
        .post('/api/queue/clear-and-resync')
        .expect(200);

      expect(response.body.success).toBe(true);

      // The second CARSA should have been able to start
      // Note: Due to async background tasks in clearAndResync, sync status may already be stopped
      // The important thing is that the API call succeeded, proving CARSA can interrupt CARSA
    });
  });

  describe('POST /api/queue task action routes', () => {
    it('should dismiss a failed task via /task/:id/dismiss', async () => {
      jest.spyOn(queueService, 'dismissFailedTask').mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/queue/task/55/dismiss')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(queueService.dismissFailedTask).toHaveBeenCalledWith(55);
    });

    it('should retry all failed tasks via /retry-all-failed', async () => {
      jest.spyOn(queueService, 'retryAllFailedTasks').mockResolvedValue({ success: true, count: 3 });

      const response = await request(app)
        .post('/api/queue/retry-all-failed')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(3);
      expect(queueService.retryAllFailedTasks).toHaveBeenCalledTimes(1);
    });

    it('should clear all failed tasks via /clear-failed', async () => {
      jest.spyOn(queueService, 'clearFailedTasks').mockResolvedValue({ success: true, count: 2 });

      const response = await request(app)
        .post('/api/queue/clear-failed')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(queueService.clearFailedTasks).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sync lock behavior', () => {
    it('should prevent concurrent library syncs', () => {
      // First sync starts
      syncStatus.start('library_sync');

      // Second sync is blocked
      const canStart = syncStatus.canStartSync('library_sync');
      expect(canStart.allowed).toBe(false);
      expect(canStart.reason).toContain('library_sync is currently running');

      // Stop first sync
      syncStatus.stop();

      // Second sync is now allowed
      const canStartNow = syncStatus.canStartSync('library_sync');
      expect(canStartNow.allowed).toBe(true);
    });

    it('should allow CARSA to always start', () => {
      // Library sync is running
      syncStatus.start('library_sync');
      syncStatus.updateProgress(50);

      // CARSA can still start
      const canStartCARSA = syncStatus.canStartSync('full_resync');
      expect(canStartCARSA.allowed).toBe(true);
    });
  });
});
