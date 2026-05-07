/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

jest.unstable_mockModule('../utils/logger.mjs', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

const { syncStatus } = await import('../services/syncStatus.mjs');

describe('SyncStatus', () => {
  beforeEach(() => {
    syncStatus.isRunning = false;
    syncStatus.type = null;
    syncStatus.progress = 0;
    syncStatus.currentLibrary = null;
    syncStatus.startedAt = null;
    syncStatus.canInterrupt = true;
  });

  describe('start', () => {
    it('should initialize sync status', () => {
      syncStatus.start('library_sync');

      expect(syncStatus.isRunning).toBe(true);
      expect(syncStatus.type).toBe('library_sync');
      expect(syncStatus.progress).toBe(0);
      expect(syncStatus.startedAt).toBeTruthy();
      expect(syncStatus.canInterrupt).toBe(true);
    });

    it('should mark sync as non-interruptible when specified', () => {
      syncStatus.start('full_resync', false);

      expect(syncStatus.isRunning).toBe(true);
      expect(syncStatus.type).toBe('full_resync');
      expect(syncStatus.canInterrupt).toBe(false);
    });
  });

  describe('updateProgress', () => {
    it('should update progress', () => {
      syncStatus.start('library_sync');
      syncStatus.updateProgress(50, 'Test Library');

      expect(syncStatus.progress).toBe(50);
      expect(syncStatus.currentLibrary).toBe('Test Library');
    });

    it('should update progress without library', () => {
      syncStatus.start('library_sync');
      syncStatus.updateProgress(75);

      expect(syncStatus.progress).toBe(75);
      expect(syncStatus.currentLibrary).toBe(null);
    });
  });

  describe('stop', () => {
    it('should reset all sync status', () => {
      syncStatus.start('full_resync', false);
      syncStatus.updateProgress(50, 'Test Library');
      syncStatus.stop();

      expect(syncStatus.isRunning).toBe(false);
      expect(syncStatus.type).toBe(null);
      expect(syncStatus.progress).toBe(0);
      expect(syncStatus.currentLibrary).toBe(null);
      expect(syncStatus.startedAt).toBe(null);
      expect(syncStatus.canInterrupt).toBe(true);
    });
  });

  describe('forceStop', () => {
    it('should stop sync immediately', () => {
      syncStatus.start('library_sync');
      syncStatus.forceStop();

      expect(syncStatus.isRunning).toBe(false);
      expect(syncStatus.type).toBe(null);
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      syncStatus.start('library_sync');
      syncStatus.updateProgress(30, 'Movies');

      const status = syncStatus.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.type).toBe('library_sync');
      expect(status.progress).toBe(30);
      expect(status.currentLibrary).toBe('Movies');
      expect(status.startedAt).toBeTruthy();
      expect(status.duration).toBeGreaterThanOrEqual(0);
      expect(status.canInterrupt).toBe(true);
    });

    it('should return idle status when not running', () => {
      const status = syncStatus.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.type).toBe(null);
      expect(status.progress).toBe(0);
      expect(status.duration).toBe(0);
    });
  });

  describe('canStartSync', () => {
    it('should allow full_resync to always start', () => {
      syncStatus.start('library_sync');
      const canStart = syncStatus.canStartSync('full_resync');

      expect(canStart.allowed).toBe(true);
    });

    it('should block library_sync when another sync is running', () => {
      syncStatus.start('library_sync');
      const canStart = syncStatus.canStartSync('library_sync');

      expect(canStart.allowed).toBe(false);
      expect(canStart.reason).toContain('library_sync is currently running');
      expect(canStart.progress).toBe(0);
    });

    it('should block incremental sync when full_resync is running', () => {
      syncStatus.start('full_resync', false);
      syncStatus.updateProgress(50);
      const canStart = syncStatus.canStartSync('incremental');

      expect(canStart.allowed).toBe(false);
      expect(canStart.reason).toContain('full_resync is currently running');
      expect(canStart.progress).toBe(50);
    });

    it('should allow sync when nothing is running', () => {
      const canStart = syncStatus.canStartSync('library_sync');

      expect(canStart.allowed).toBe(true);
    });
  });

  describe('concurrent sync prevention', () => {
    it('should prevent multiple library syncs at once', () => {
      syncStatus.start('library_sync');
      
      const canStart1 = syncStatus.canStartSync('library_sync');
      const canStart2 = syncStatus.canStartSync('incremental');

      expect(canStart1.allowed).toBe(false);
      expect(canStart2.allowed).toBe(false);
    });

    it('should allow CARSA to interrupt active sync', () => {
      syncStatus.start('library_sync');
      
      const canStartCARSA = syncStatus.canStartSync('full_resync');

      expect(canStartCARSA.allowed).toBe(true);
    });
  });

  describe('tryStart - atomic lock acquisition', () => {
    it('should atomically start sync when nothing is running', () => {
      const result = syncStatus.tryStart('library_sync');

      expect(result.started).toBe(true);
      expect(syncStatus.isRunning).toBe(true);
      expect(syncStatus.type).toBe('library_sync');
    });

    it('should fail to start when sync is already running', () => {
      syncStatus.start('library_sync');
      
      const result = syncStatus.tryStart('incremental');

      expect(result.started).toBe(false);
      expect(result.reason).toContain('library_sync is currently running');
      expect(syncStatus.type).toBe('library_sync');
    });

    it('should allow CARSA to start via tryStart even when sync is running', () => {
      syncStatus.start('library_sync');
      
      const result = syncStatus.tryStart('full_resync', false);

      expect(result.started).toBe(true);
      expect(syncStatus.type).toBe('full_resync');
      expect(syncStatus.canInterrupt).toBe(false);
    });

    it('should prevent TOCTOU race conditions', () => {
      const result1 = syncStatus.tryStart('library_sync');
      const result2 = syncStatus.tryStart('library_sync');

      expect(result1.started).toBe(true);
      expect(result2.started).toBe(false);
      expect(result2.reason).toContain('library_sync is currently running');
    });
  });

  describe('CARSA interruption logic', () => {
    it('should allow CARSA to start even when library_sync is running', () => {
      syncStatus.start('library_sync');
      syncStatus.updateProgress(50, 'Movies');

      const canStart = syncStatus.canStartSync('full_resync');

      expect(canStart.allowed).toBe(true);
    });

    it('should allow CARSA to start when another CARSA is running', () => {
      syncStatus.start('full_resync', false);
      syncStatus.updateProgress(25);

      const canStart = syncStatus.canStartSync('full_resync');

      expect(canStart.allowed).toBe(true);
    });
  });
});
