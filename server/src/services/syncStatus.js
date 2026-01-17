/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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
 */
class SyncStatus {
  constructor() {
    this.isRunning = false;
    this.type = null;           // 'library_sync' | 'full_resync' | 'incremental'
    this.progress = 0;
    this.currentLibrary = null;
    this.startedAt = null;
    this.canInterrupt = true;   // CARSA can always interrupt
  }

  start(type, canInterrupt = true) {
    this.isRunning = true;
    this.type = type;
    this.progress = 0;
    this.startedAt = Date.now();
    this.canInterrupt = canInterrupt;
    logger.info('Sync started', { type, canInterrupt });
  }

  updateProgress(progress, currentLibrary = null) {
    this.progress = progress;
    this.currentLibrary = currentLibrary;
    logger.debug('Sync progress updated', { progress, currentLibrary, type: this.type });
  }

  stop() {
    logger.info('Sync stopped', { type: this.type, duration: this.startedAt ? Date.now() - this.startedAt : 0 });
    this.isRunning = false;
    this.type = null;
    this.progress = 0;
    this.currentLibrary = null;
    this.startedAt = null;
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
}

module.exports = new SyncStatus();
