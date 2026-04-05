/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ProviderLock');

/**
 * Provider Lock Service
 * Manages heartbeat-based locking to prevent Ollama resource contention
 * Classification always has priority over embedding operations
 */
class ProviderLockService {
  constructor() {
    this.lockState = {
      isLocked: false,
      lockedBy: null, // 'classification' | 'embedding'
      lastHeartbeat: null,
      startTime: null,
      preemptRequested: false,
      activeModel: null, // Track which model the lock holder is using
    };
    this.config = {
      heartbeatTimeout: 30000, // 30 seconds - release lock if no heartbeat
      heartbeatInterval: 5000, // 5 seconds - how often to send heartbeat
      maxWaitTime: 120000, // 120 seconds - max time to wait for lock (increased for safety)
    };
    this.configLoaded = false;
    this.configLoadAttempted = false;
    this.configLoadPromise = null;

    // Promise queue to ensure atomic lock acquisitions
    this.acquisitionQueue = Promise.resolve();
  }

  /**
   * Load heartbeat configuration from database
   */
  async loadConfig() {
    try {
      const result = await db.query(`
        SELECT heartbeat_timeout, heartbeat_interval, max_wait_time
        FROM ai_provider_config WHERE id = 1
      `);

      if (result.rows.length > 0) {
        const dbConfig = result.rows[0];
        if (dbConfig.heartbeat_timeout) this.config.heartbeatTimeout = dbConfig.heartbeat_timeout;
        if (dbConfig.heartbeat_interval) this.config.heartbeatInterval = dbConfig.heartbeat_interval;
        if (dbConfig.max_wait_time) this.config.maxWaitTime = dbConfig.max_wait_time;

        this.configLoaded = true;
        logger.info('Loaded heartbeat config from database', this.config);
      }
    } catch (error) {
      logger.warn('Failed to load heartbeat config from database, using defaults:', error.message);
    } finally {
      this.configLoadAttempted = true;
    }
  }

  /**
   * Explicit initialization to avoid DB access on module import.
   * Safe to call multiple times; only the first call triggers a load.
   */
  async init() {
    if (this.configLoadAttempted) {
      return this.configLoadPromise;
    }

    if (!this.configLoadPromise) {
      this.configLoadPromise = this.loadConfig().catch((error) => {
        logger.warn('ProviderLock init failed, continuing with defaults:', error.message);
      });
    }

    return this.configLoadPromise;
  }

  /**
   * Acquire lock for provider access
   * Uses a promise queue to ensure atomic state transitions and prevent race conditions
   * @param {string} requestor - 'classification' or 'embedding'
   * @param {string} priority - 'high' (classification) or 'normal' (embedding)
   * @returns {Promise<boolean>} True if lock acquired
   * @throws {Error} If the max wait time is exceeded while waiting for the lock
   */
  async acquireLock(requestor, priority = 'normal') {
    // Queue this acquisition request to ensure atomicity
    // Each request waits for the previous one to complete before checking/setting lock state
    const acquisitionPromise = this.acquisitionQueue.then(async () => {
      return await this._acquireLockInternal(requestor, priority);
    });

    // Update queue to chain next request after this one
    this.acquisitionQueue = acquisitionPromise.catch(() => {
      // Catch errors so queue continues even if this acquisition fails
    });

    return acquisitionPromise;
  }

  /**
   * Internal lock acquisition logic (called via queue for atomicity)
   * @private
   */
  async _acquireLockInternal(requestor, priority = 'normal') {
    const startWait = Date.now();

    while (this.lockState.isLocked) {
      // Check for stale lock (no heartbeat)
      if (this.lockState.lastHeartbeat &&
        Date.now() - this.lockState.lastHeartbeat > this.config.heartbeatTimeout) {
        const staleOwner = this.lockState.lockedBy;
        logger.warn(`Releasing stale lock held by ${staleOwner}`);
        // Attempt to release and verify we actually released it
        const released = this.releaseLock(staleOwner);
        if (released) {
          break; // Successfully released stale lock
        }
        // If release failed, another thread might have already handled it
        continue;
      }

      // Classification can preempt embedding
      if (priority === 'high' && this.lockState.lockedBy === 'embedding') {
        if (!this.lockState.preemptRequested) {
          logger.info('Classification preempting embedding');
        }
        // Signal embedding to pause; actual yielding happens on its next heartbeat
        this.lockState.preemptRequested = true;
        // Continue looping to check if lock was released
        await this.sleep(1000);
        continue;
      }

      // Check max wait time
      const waitMs = Date.now() - startWait;
      if (waitMs > this.config.maxWaitTime) {
        const error = new Error(`[ProviderLock] Timeout waiting for lock (requestor: ${requestor})`);
        error.code = 'PROVIDER_LOCK_TIMEOUT';
        error.requestor = requestor;
        error.waitMs = waitMs;
        error.lockHolder = this.lockState.lockedBy || null;
        error.activeModel = this.lockState.activeModel || null;
        error.preemptRequested = this.lockState.preemptRequested === true;
        throw error;
      }

      await this.sleep(1000);
    }

    // Atomic state transition - at this point we're guaranteed to be the only one setting the lock
    this.lockState = {
      isLocked: true,
      lockedBy: requestor,
      lastHeartbeat: Date.now(),
      startTime: Date.now(),
      preemptRequested: false,
    };

    logger.info(`Lock acquired by ${requestor}`);
    return true;
  }

  /**
   * Send heartbeat to maintain lock
   * @param {string} requestor - 'classification' or 'embedding'
   * @returns {boolean} True if should continue, false if should yield
   * @throws {Error} If the requestor does not currently hold the lock
   */
  heartbeat(requestor) {
    if (this.lockState.lockedBy !== requestor) {
      const owner = this.lockState.lockedBy || 'none';
      const message = `Heartbeat called by "${requestor}" but lock is held by "${owner}"`;
      logger.error(message);
      throw new Error(message);
    }

    this.lockState.lastHeartbeat = Date.now();
    return !this.lockState.preemptRequested; // Return false if should yield
  }

  /**
   * Release lock
   * @param {string} requestor - 'classification' or 'embedding'
   * @returns {boolean} True if lock was released
   */
  releaseLock(requestor) {
    // Only allow the current lock holder to release the lock
    if (!this.lockState.isLocked) {
      logger.warn(`Release lock requested by ${requestor}, but no lock is currently held`);
      return false;
    }

    if (this.lockState.lockedBy !== requestor) {
      logger.warn(
        `Release lock denied for ${requestor}; lock is currently held by ${this.lockState.lockedBy}`
      );
      return false;
    }

    logger.info(`Lock released by ${requestor}`);
    this.lockState = {
      isLocked: false,
      lockedBy: null,
      lastHeartbeat: null,
      startTime: null,
      preemptRequested: false,
      activeModel: null, // Reset active model on release
    };
    return true;
  }

  /**
   * Set the active model being used by the current lock holder
   * Enables model affinity tracking for smarter batching
   * @param {string} modelName - Name of the model being used
   */
  setActiveModel(modelName) {
    if (this.lockState.isLocked) {
      this.lockState.activeModel = modelName;
      logger.debug('Active model set', { model: modelName, lockedBy: this.lockState.lockedBy });
    }
  }

  /**
   * Get the currently active model
   * @returns {string|null} Current model name or null
   */
  getActiveModel() {
    return this.lockState.activeModel;
  }

  /**
   * Check if preemption is pending for embedding operations
   * Embeddings should call this BEFORE starting HTTP requests to Ollama
   * @returns {boolean} True if embedding should yield to classification
   */
  isPreemptPending() {
    return this.lockState.preemptRequested && this.lockState.lockedBy === 'embedding';
  }

  /**
   * Get current lock status
   * @returns {object} Lock status information
   */
  getLockStatus() {
    return {
      ...this.lockState,
      config: this.config,
      lockDuration: this.lockState.startTime
        ? Date.now() - this.lockState.startTime
        : 0,
    };
  }

  /**
   * Update heartbeat configuration
   * @param {object} newConfig - New configuration values
   */
  async updateConfig(newConfig) {
    // Create new config object atomically
    const updatedConfig = {
      ...this.config,
      ...newConfig
    };

    // Persist to database first
    try {
      await db.query(`
        UPDATE ai_provider_config SET
          heartbeat_timeout = $1,
          heartbeat_interval = $2,
          max_wait_time = $3
        WHERE id = 1
      `, [
        updatedConfig.heartbeatTimeout,
        updatedConfig.heartbeatInterval,
        updatedConfig.maxWaitTime
      ]);

      // Only update in-memory config after successful DB write
      this.config = updatedConfig;

      logger.info('Updated heartbeat config', this.config);
    } catch (error) {
      logger.error('Failed to update heartbeat config in database:', error);
      throw error;
    }
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new ProviderLockService();
