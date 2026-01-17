/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const request = require('supertest');
const express = require('express');

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

const syncRouter = require('../../routes/sync');
const mediaSyncRouter = require('../../routes/mediaSync');
const queueRouter = require('../../routes/queue');
const syncStatus = require('../../services/syncStatus');
const queueService = require('../../services/queueService');
const mediaSyncService = require('../../services/mediaSync');
const db = require('../../config/database');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/sync', syncRouter);
app.use('/api/media-sync', mediaSyncRouter);
app.use('/api/queue', queueRouter);

describe('Sync Lock Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset sync status
    syncStatus.isRunning = false;
    syncStatus.type = null;
    syncStatus.progress = 0;
    syncStatus.currentLibrary = null;
    syncStatus.startedAt = null;
    syncStatus.canInterrupt = true;
    
    // Mock queueService
    queueService.running = false;
    queueService.stopWorker = jest.fn();
    queueService.startWorker = jest.fn();
    queueService.omdbLimitHit = false;
    
    // Default mock implementations
    mediaSyncService.syncLibrary.mockResolvedValue({ success: true });
    mediaSyncService.syncAllLibraries.mockResolvedValue();
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
      syncStatus.start('full_resync', false);
      syncStatus.updateProgress(25);

      const response = await request(app)
        .post('/api/queue/clear-and-resync')
        .expect(200);

      expect(response.body.success).toBe(true);
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
