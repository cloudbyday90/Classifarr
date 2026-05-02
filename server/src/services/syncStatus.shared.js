/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const { createLogger } = require('../utils/logger');

const logger = createLogger('SyncStatus');

/**
 * Singleton to track sync status and provide locking
 *
 * This provides application-level locking for sync operations to prevent concurrent
 * execution of "Sync Libraries" and "Clear & Re-sync All" (CARSA) operations.
 *
 * Note: This works alongside database-level sync tracking (media_server_sync_status table).
 * - Application lock (this singleton): Prevents concurrent sync API requests
 * - Database tracking: Records per-library sync history and status
 *
 * The mediaSync service's syncLibrary() method uses database-level tracking for
 * individual library syncs. When called from the API endpoint, both locks are active.
 * When called internally (e.g., by syncAllLibraries() during CARSA), only database
 * tracking is used since the application lock is already held by the parent operation.
 */
class SyncStatus {
  constructor() {
    this.isRunning = false;
    this.type = null;           // 'library_sync' | 'full_resync' | 'incremental'
    this.progress = 0;
    this.currentLibrary = null;
    this.startedAt = null;
    this.canInterrupt = true;   // Informational flag - actual interruption logic is based on sync type
  }

  start(type, canInterrupt = true) {
    this.isRunning = true;
    this.type = type;
    this.progress = 0;
    this.startedAt = Date.now();
    this.canInterrupt = canInterrupt;
    logger.info('Sync started', { type, canInterrupt });
    return { started: true };
  }

  updateProgress(progress, currentLibrary = null) {
    this.progress = progress;
    this.currentLibrary = currentLibrary;
    logger.debug('Sync progress updated', { progress, currentLibrary, type: this.type });
  }

  stop() {
    logger.info('Sync stopped', { type: this.type, duration: this.startedAt ? Date.now() - this.startedAt : 0 });
    this.reset();
  }

  reset() {
    // Reset all state to initial values
    this.isRunning = false;
    this.type = null;
    this.progress = 0;
    this.currentLibrary = null;
    this.startedAt = null;
    this.canInterrupt = true;
  }

  forceStop() {
    // Called by CARSA to interrupt any running sync
    logger.warn('Sync force stopped', { type: this.type });
    this.stop();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      type: this.type,
      progress: this.progress,
      currentLibrary: this.currentLibrary,
      startedAt: this.startedAt,
      duration: this.startedAt ? Date.now() - this.startedAt : 0,
      canInterrupt: this.canInterrupt
    };
  }

  canStartSync(type) {
    // CARSA (full_resync) can always start
    if (type === 'full_resync') {
      return { allowed: true };
    }

    // Other syncs blocked if something is running
    if (this.isRunning) {
      return {
        allowed: false,
        reason: `${this.type} is currently running`,
        progress: this.progress
      };
    }

    return { allowed: true };
  }

  /**
   * Atomically check and start sync to prevent TOCTOU race conditions
   * Returns { started: true } if sync was started, { started: false, reason, progress } if blocked
   */
  tryStart(type, canInterrupt = true) {
    // CARSA (full_resync) can always start
    if (type === 'full_resync') {
      return this.start(type, canInterrupt);
    }

    // Other syncs blocked if something is running
    if (this.isRunning) {
      return {
        started: false,
        reason: `${this.type} is currently running`,
        progress: this.progress
      };
    }

    return this.start(type, canInterrupt);
  }
}

module.exports = new SyncStatus();
