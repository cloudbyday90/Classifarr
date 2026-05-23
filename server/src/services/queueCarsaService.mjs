/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { setTimeout as sleepFor } from 'node:timers/promises';
import { mediaSyncService as defaultMediaSyncService } from './mediaSync.mjs';
import { classificationEvidenceService } from './classificationEvidenceService.mjs';
import {
    buildLibrarySnapshot as _buildLibrarySnapshot,
    buildNewLibraryLookup as _buildNewLibraryLookup,
    findNewLibraryId as _findNewLibraryId,
    remapInstanceMappings as _remapInstanceMappings,
    remapAllArrMappings as _remapAllArrMappings,
    createRemapFailureNotification as _createRemapFailureNotification
} from './queueCarsaLibraryRemap.mjs';
import {
    isForeignKeyConstraintError as _isForeignKeyConstraintError,
    normalizeClearAndResyncError as _normalizeClearAndResyncError,
    performClearAndResyncCleanup as _performClearAndResyncCleanup
} from './queueCarsaCleanup.mjs';

export class QueueCarsaService {
    constructor(deps = {}) {
        this.db = deps.db;
        this.logger = deps.logger;
        this.syncStatus = deps.syncStatus;
        this.mediaSyncService = deps.mediaSyncService || defaultMediaSyncService;
        this.evidenceService = deps.evidenceService || classificationEvidenceService;
        this.scheduler = deps.scheduler || null;
        this.getScheduler = deps.getScheduler || (async () => {
            if (!this.scheduler) {
                throw new Error('Scheduler service is not configured');
            }

            return this.scheduler;
        });
        this.getWorkerState = deps.getWorkerState || (() => ({ running: false, processing: 0 }));
        this.startWorker = deps.startWorker || (async () => {});
        this.stopWorker = deps.stopWorker || (() => {});

        this.captureLibrarySnapshot = deps.captureLibrarySnapshot || (() => this.buildLibrarySnapshot());
        this.buildLibraryLookup = deps.buildLibraryLookup || (() => this.buildNewLibraryLookup());
        this.remapMappings = deps.remapMappings || ((snapshot, lookup) => this.remapAllArrMappings(snapshot, lookup));
        this.notifyRemapFailures = deps.notifyRemapFailures || ((results) => this.createRemapFailureNotification(results));
        this.performCleanup = deps.performCleanup || (() => this.performClearAndResyncCleanup());
        this.resetVolatileState = deps.resetVolatileState || (() => {});
    }

    setScheduler(scheduler) {
        this.scheduler = scheduler;
    }

    async buildLibrarySnapshot() {
        return _buildLibrarySnapshot(this.db, this.logger);
    }

    async buildNewLibraryLookup() {
        return _buildNewLibraryLookup(this.db, this.logger);
    }

    findNewLibraryId(oldLibInfo, newLookup) {
        return _findNewLibraryId(oldLibInfo, newLookup);
    }

    async remapInstanceMappings(type, config, snapshot, newLookup) {
        return _remapInstanceMappings(this.db, this.logger, type, config, snapshot, newLookup);
    }

    async remapAllArrMappings(oldLibrarySnapshot, newLibraryLookup) {
        return _remapAllArrMappings(this.db, this.logger, oldLibrarySnapshot, newLibraryLookup);
    }

    async createRemapFailureNotification(results) {
        return _createRemapFailureNotification(this.db, this.logger, results);
    }

    async withOptionalTransaction(work, context = 'transaction') {
        return this.db.withTransaction(work).catch((error) => {
            this.logger.warn('Transaction failed', { context, error: error.message });
            throw error;
        });
    }

    isForeignKeyConstraintError(error) {
        return _isForeignKeyConstraintError(error);
    }

    normalizeClearAndResyncError(error) {
        return _normalizeClearAndResyncError(error);
    }

    async performClearAndResyncCleanup() {
        return _performClearAndResyncCleanup(this.db, this.syncStatus, this.evidenceService, this.logger);
    }

    async clearAndResync() {
        const wasRunning = Boolean(this.getWorkerState().running);
        try {
            if (this.syncStatus.isRunning) {
                this.logger.info('CARSA interrupting active sync', { type: this.syncStatus.type });
                this.syncStatus.forceStop();
            }

            this.syncStatus.start('full_resync', false);

            this.logger.info('Starting clear and resync process...');

            this.syncStatus.updateProgress(5, 'Capturing library snapshot...');
            const oldLibrarySnapshot = await this.captureLibrarySnapshot();

            this.logger.info('Captured pre-clear snapshot', {
                libraries: Object.keys(oldLibrarySnapshot.libraries).length,
                mappings: oldLibrarySnapshot.mappings.length
            });

            if (wasRunning) {
                this.stopWorker();
                const DRAIN_POLL_MS = 100;
                const DRAIN_TIMEOUT_MS = 15_000;
                const drainDeadline = Date.now() + DRAIN_TIMEOUT_MS;
                while (this.getWorkerState().processing > 0 && Date.now() < drainDeadline) {
                    await sleepFor(DRAIN_POLL_MS);
                }
                if (this.getWorkerState().processing > 0) {
                    this.logger.warn('CARSA proceeding with in-flight tasks still active after drain timeout', {
                        inFlight: this.getWorkerState().processing,
                        drainTimeoutMs: DRAIN_TIMEOUT_MS,
                    });
                }
            }

            this.syncStatus.updateProgress(10, 'Stopping worker...');

            const cleanupResult = await this.performCleanup();
            const {
                queueResult,
                embeddingsResult,
                historyResult,
                patternsResult,
                correctionsResult,
                rulesV2Result,
                syncStatusRowsResult,
                collectionsResult,
                itemsResult,
                librariesResult,
                feedbackLibraryRefsCleared
            } = cleanupResult;

            this.logger.info('Cleared all synced data', {
                queue: queueResult.rowCount,
                embeddings: embeddingsResult.rowCount,
                history: historyResult.rowCount,
                patterns: patternsResult.rowCount,
                corrections: correctionsResult.rowCount,
                rules: rulesV2Result.rowCount,
                syncStatusRows: syncStatusRowsResult.rowCount,
                collections: collectionsResult.rowCount,
                items: itemsResult.rowCount,
                libraries: librariesResult.rowCount,
                feedbackLibraryRefsCleared
            });

            this.resetVolatileState();

            this.syncStatus.updateProgress(75, 'Restarting worker...');

            if (wasRunning) {
                this.startWorker();
            }

            this.syncStatus.updateProgress(80, 'Starting fresh sync...');

            (async () => {
                try {
                    await this.mediaSyncService.syncAllLibraries();

                    this.logger.info('Fresh library sync completed after clear');

                    this.syncStatus.updateProgress(85, 'Remapping library mappings...');

                    const newLibraryLookup = await this.buildLibraryLookup();
                    const remapResults = await this.remapMappings(
                        oldLibrarySnapshot,
                        newLibraryLookup
                    );

                    this.logger.info('Library mapping restoration complete', {
                        totalRemapped: remapResults.totalRemapped,
                        totalFailed: remapResults.totalFailed
                    });

                    if (remapResults.totalFailed > 0) {
                        await this.notifyRemapFailures(remapResults);
                    }

                    this.syncStatus.updateProgress(90, 'Running gap analysis...');

                    const scheduler = await this.getScheduler();
                    await scheduler.runGapAnalysis();

                    this.logger.info('Gap analysis triggered after clear');

                    this.syncStatus.updateProgress(100, 'Complete');
                    this.syncStatus.stop();
                } catch (err) {
                    this.logger.error('Failed to run library sync after clear', { error: err.message });
                    this.syncStatus.stop();

                    try {
                        await this.db.query(`
                            INSERT INTO app_notifications (type, title, message, data, created_at)
                            VALUES ($1, $2, $3, $4, NOW())
                        `, [
                            'error',
                            'Library sync failed after CARSA',
                            'Failed to complete library re-sync and mapping restoration after Clear and Re-sync All. Please check logs and try again.',
                            JSON.stringify({ error: err.message, timestamp: new Date().toISOString() })
                        ]);
                    } catch (notifErr) {
                        this.logger.error('Failed to create error notification', { error: notifErr.message });
                    }
                }
            })();

            const result = {
                success: true,
                queueCleared: queueResult.rowCount,
                embeddingsCleared: embeddingsResult.rowCount,
                historyCleared: historyResult.rowCount,
                patternsCleared: patternsResult.deleted,
                correctionsCleared: correctionsResult.rowCount,
                rulesCleared: rulesV2Result.rowCount,
                syncStatusRowsCleared: syncStatusRowsResult.rowCount,
                collectionsCleared: collectionsResult.rowCount,
                itemsReset: itemsResult.rowCount,
                librariesCleared: librariesResult.rowCount,
                feedbackLibraryRefsCleared
            };

            this.logger.info('Cleared queue and triggered resync', result);
            return result;
        } catch (error) {
            const normalizedError = this.normalizeClearAndResyncError(error);
            this.logger.error('Failed to clear and resync', {
                error: normalizedError.message,
                code: normalizedError.code || null,
                details: normalizedError.details || null
            });
            this.syncStatus.stop();

            if (wasRunning && !this.getWorkerState().running) {
                this.startWorker().catch((restartError) => {
                    this.logger.error('Failed to restart worker after CARSA error', {
                        error: restartError.message
                    });
                });
                this.logger.warn('CARSA failed; worker restart requested');
            }

            throw normalizedError;
        }
    }
}
