/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { syncStatus } from '../../services/syncStatus.mjs';
import { createSyncRouter } from '../../routes/syncRouteShared.mjs';
import { createMediaSyncRouter } from '../../routes/mediaSyncRouteShared.mjs';
import { createQueueRouter } from '../../routes/queueRouteShared.mjs';

function createLogger() {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };
}

function createRouteDeps(overrides = {}) {
  return {
    createLogger,
    logger: createLogger(),
    authenticateTokenOrApiKey: (_req, _res, next) => next(),
    requireReadWrite: (_req, _res, next) => next(),
    errors: {
      isLibraryNotFoundError: () => false,
    },
    ...overrides,
  };
}

const queueService = {
  running: false,
  stopWorker: jest.fn(),
  startWorker: jest.fn(),
  omdbLimitHit: false,
  clearAndResync: jest.fn(),
  dismissFailedTask: jest.fn(),
  retryAllFailedTasks: jest.fn(),
  clearFailedTasks: jest.fn(),
};

const mediaSyncService = {
  syncLibrary: jest.fn(),
  syncAllLibraries: jest.fn(),
  getLibraryItems: jest.fn(),
  findExistingMedia: jest.fn(),
  getSyncStatus: jest.fn(),
};

const app = express();
app.use(express.json());
app.use('/api/sync', createSyncRouter({
  express,
  syncStatus,
  logger: createLogger(),
}));

app.use('/api/media-sync', createMediaSyncRouter({
  express,
  syncStatus,
  mediaSyncService,
  ...createRouteDeps(),
}));

app.use('/api/queue', createQueueRouter({
  express,
  queueService,
  ...createRouteDeps(),
}));

describe('Sync Lock Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    queueService.running = false;
    queueService.omdbLimitHit = false;
    queueService.stopWorker.mockReset();
    queueService.startWorker.mockReset();
    queueService.clearAndResync.mockReset().mockResolvedValue({ success: true });
    queueService.dismissFailedTask.mockReset();
    queueService.retryAllFailedTasks.mockReset();
    queueService.clearFailedTasks.mockReset();

    mediaSyncService.syncLibrary.mockReset().mockResolvedValue({ success: true });
    mediaSyncService.syncAllLibraries.mockReset().mockResolvedValue(undefined);
    mediaSyncService.getLibraryItems.mockReset();
    mediaSyncService.findExistingMedia.mockReset();
    mediaSyncService.getSyncStatus.mockReset();

    syncStatus.reset();
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
      expect(syncStatus.isRunning).toBe(false);
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

      expect(syncStatus.isRunning).toBe(false);
    });

    it('should prevent TOCTOU race condition with concurrent requests', async () => {
      mediaSyncService.syncLibrary.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve({ success: true }), 100);
        });
      });

      const request1Promise = request(app)
        .post('/api/media-sync/sync/1')
        .send({ incremental: false });

      const request2Promise = request(app)
        .post('/api/media-sync/sync/2')
        .send({ incremental: false });

      const [response1, response2] = await Promise.all([request1Promise, request2Promise]);

      const responses = [response1, response2];
      const successCount = responses.filter((response) => response.status === 200).length;
      const blockedCount = responses.filter((response) => response.status === 409).length;

      expect(successCount).toBe(1);
      expect(blockedCount).toBe(1);

      const blockedResponse = responses.find((response) => response.status === 409);
      expect(blockedResponse.body.error).toBe('Sync already in progress');
      expect(blockedResponse.body.message).toContain('library_sync is currently running');
      expect(mediaSyncService.syncLibrary).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/queue/clear-and-resync', () => {
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
      syncStatus.start('full_resync', false);
      syncStatus.updateProgress(25);

      const response = await request(app)
        .post('/api/queue/clear-and-resync')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/queue task action routes', () => {
    it('should dismiss a failed task via /task/:id/dismiss', async () => {
      queueService.dismissFailedTask.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/queue/task/55/dismiss')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(queueService.dismissFailedTask).toHaveBeenCalledWith(55);
    });

    it('should retry all failed tasks via /retry-all-failed', async () => {
      queueService.retryAllFailedTasks.mockResolvedValue({ success: true, count: 3 });

      const response = await request(app)
        .post('/api/queue/retry-all-failed')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(3);
      expect(queueService.retryAllFailedTasks).toHaveBeenCalledTimes(1);
    });

    it('should clear all failed tasks via /clear-failed', async () => {
      queueService.clearFailedTasks.mockResolvedValue({ success: true, count: 2 });

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
      syncStatus.start('library_sync');

      const canStart = syncStatus.canStartSync('library_sync');
      expect(canStart.allowed).toBe(false);
      expect(canStart.reason).toContain('library_sync is currently running');

      syncStatus.stop();

      const canStartNow = syncStatus.canStartSync('library_sync');
      expect(canStartNow.allowed).toBe(true);
    });

    it('should allow CARSA to always start', () => {
      syncStatus.start('library_sync');
      syncStatus.updateProgress(50);

      const canStartCARSA = syncStatus.canStartSync('full_resync');
      expect(canStartCARSA.allowed).toBe(true);
    });
  });
});
