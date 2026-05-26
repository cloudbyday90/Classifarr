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

import { setTimeout as sleepFor } from 'node:timers/promises';
import { ConflictError } from '../utils/appError.mjs';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('ProviderLock');

class ProviderLockService {
    constructor() {
        this.lockState = {
            isLocked: false,
            lockedBy: null,
            lastHeartbeat: null,
            startTime: null,
            preemptRequested: false,
            activeModel: null,
        };
        this.config = {
            heartbeatTimeout: 30000,
            heartbeatInterval: 5000,
            maxWaitTime: 120000,
        };
        this.configLoaded = false;
        this.configLoadAttempted = false;
        this.configLoadPromise = null;
        this.acquisitionQueue = Promise.resolve();
    }

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

    async acquireLock(requestor, priority = 'normal') {
        const acquisitionPromise = this.acquisitionQueue.then(async () => this._acquireLockInternal(requestor, priority));

        this.acquisitionQueue = acquisitionPromise.catch(() => {
        });

        return acquisitionPromise;
    }

    async _acquireLockInternal(requestor, priority = 'normal') {
        const startWait = Date.now();

        while (this.lockState.isLocked) {
            if (
                this.lockState.lastHeartbeat &&
                Date.now() - this.lockState.lastHeartbeat > this.config.heartbeatTimeout
            ) {
                const staleOwner = this.lockState.lockedBy;
                logger.warn(`Releasing stale lock held by ${staleOwner}`);
                const released = this.releaseLock(staleOwner);
                if (released) {
                    break;
                }
                continue;
            }

            if (priority === 'high' && this.lockState.lockedBy === 'embedding') {
                if (!this.lockState.preemptRequested) {
                    logger.info('Classification preempting embedding');
                }
                this.lockState.preemptRequested = true;
                await this.sleep(1000);
                continue;
            }

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

    heartbeat(requestor) {
        if (this.lockState.lockedBy !== requestor) {
            const owner = this.lockState.lockedBy || 'none';
            const message = `Heartbeat called by "${requestor}" but lock is held by "${owner}"`;
            logger.error(message);
            throw new ConflictError(message);
        }

        this.lockState.lastHeartbeat = Date.now();
        return !this.lockState.preemptRequested;
    }

    releaseLock(requestor) {
        if (!this.lockState.isLocked) {
            logger.warn(`Release lock requested by ${requestor}, but no lock is currently held`);
            return false;
        }

        if (this.lockState.lockedBy !== requestor) {
            logger.warn(
                `Release lock denied for ${requestor}; lock is currently held by ${this.lockState.lockedBy}`,
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
            activeModel: null,
        };
        return true;
    }

    setActiveModel(modelName) {
        if (this.lockState.isLocked) {
            this.lockState.activeModel = modelName;
            logger.debug('Active model set', { model: modelName, lockedBy: this.lockState.lockedBy });
        }
    }

    getActiveModel() {
        return this.lockState.activeModel;
    }

    isPreemptPending() {
        return this.lockState.preemptRequested && this.lockState.lockedBy === 'embedding';
    }

    getLockStatus() {
        return {
            ...this.lockState,
            config: this.config,
            lockDuration: this.lockState.startTime
                ? Date.now() - this.lockState.startTime
                : 0,
        };
    }

    async updateConfig(newConfig) {
        const updatedConfig = {
            ...this.config,
            ...newConfig,
        };

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
                updatedConfig.maxWaitTime,
            ]);

            this.config = updatedConfig;

            logger.info('Updated heartbeat config', this.config);
        } catch (error) {
            logger.error('Failed to update heartbeat config in database:', error);
            throw error;
        }
    }

    sleep(ms) {
        return sleepFor(ms);
    }
}

export const providerLock = new ProviderLockService();

export { ProviderLockService };
