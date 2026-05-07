/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('SyncStatus');

class SyncStatus {
  constructor() {
    this.isRunning = false;
    this.type = null;
    this.progress = 0;
    this.currentLibrary = null;
    this.startedAt = null;
    this.canInterrupt = true;
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
    this.isRunning = false;
    this.type = null;
    this.progress = 0;
    this.currentLibrary = null;
    this.startedAt = null;
    this.canInterrupt = true;
  }

  forceStop() {
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
    if (type === 'full_resync') {
      return { allowed: true };
    }

    if (this.isRunning) {
      return {
        allowed: false,
        reason: `${this.type} is currently running`,
        progress: this.progress
      };
    }

    return { allowed: true };
  }

  tryStart(type, canInterrupt = true) {
    if (type === 'full_resync') {
      return this.start(type, canInterrupt);
    }

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

export const syncStatus = new SyncStatus();
