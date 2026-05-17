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
import { persistRagAuditLog } from './ragAuditLogService.mjs';

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
        try {
            const librariesResult = await this.db.query(`
                SELECT
                    l.id,
                    l.name,
                    l.media_type,
                    l.external_id,
                    ms.type as media_server_type
                FROM libraries l
                LEFT JOIN media_server ms ON l.media_server_id = ms.id
            `);

            const mappingsResult = await this.db.query(`
                SELECT * FROM library_arr_mappings
            `);

            const snapshot = {
                libraries: {},
                mappings: mappingsResult.rows
            };

            for (const lib of librariesResult.rows) {
                snapshot.libraries[lib.id] = {
                    name: lib.name,
                    media_type: lib.media_type,
                    external_id: lib.external_id,
                    media_server_type: lib.media_server_type
                };
            }

            this.logger.info('Built library snapshot', {
                libraryCount: Object.keys(snapshot.libraries).length,
                mappingCount: snapshot.mappings.length
            });
            return snapshot;
        } catch (error) {
            this.logger.error('Failed to build library snapshot', { error: error.message });
            throw error;
        }
    }

    async buildNewLibraryLookup() {
        try {
            const result = await this.db.query(`
                SELECT
                    l.id,
                    l.name,
                    l.media_type,
                    l.external_id,
                    ms.type as media_server_type
                FROM libraries l
                LEFT JOIN media_server ms ON l.media_server_id = ms.id
            `);

            const lookup = {
                byExternalId: {},
                byNameType: {}
            };

            for (const lib of result.rows) {
                if (lib.external_id && lib.media_server_type) {
                    const key = `${lib.media_server_type}:${lib.external_id}`;
                    lookup.byExternalId[key] = lib.id;
                }

                const nameKey = `${lib.name.toLowerCase()}|${lib.media_type}`;
                lookup.byNameType[nameKey] = lib.id;
            }

            this.logger.info('Built new library lookup', {
                byExternalId: Object.keys(lookup.byExternalId).length,
                byNameType: Object.keys(lookup.byNameType).length
            });

            return lookup;
        } catch (error) {
            this.logger.error('Failed to build library lookup', { error: error.message });
            throw error;
        }
    }

    findNewLibraryId(oldLibInfo, newLookup) {
        if (oldLibInfo.external_id && oldLibInfo.media_server_type) {
            const key = `${oldLibInfo.media_server_type}:${oldLibInfo.external_id}`;
            if (newLookup.byExternalId[key]) {
                return newLookup.byExternalId[key];
            }
        }

        const nameKey = `${oldLibInfo.name.toLowerCase()}|${oldLibInfo.media_type}`;
        if (newLookup.byNameType[nameKey]) {
            return newLookup.byNameType[nameKey];
        }

        return null;
    }

    async remapInstanceMappings(type, config, snapshot, newLookup) {
        const result = {
            remapped: 0,
            failed: 0,
            failedLibraries: []
        };

        try {
            const instanceMappings = snapshot.mappings.filter(
                m => m.arr_type === type && m.arr_config_id === config.id
            );

            if (instanceMappings.length === 0) {
                this.logger.debug('No mappings found in snapshot for instance', {
                    type,
                    configId: config.id
                });
                return result;
            }

            for (const mapping of instanceMappings) {
                const oldLibInfo = snapshot.libraries[mapping.library_id];

                if (!oldLibInfo) {
                    result.failed++;
                    result.failedLibraries.push({
                        oldId: mapping.library_id,
                        reason: 'Library not found in snapshot'
                    });
                    continue;
                }

                const newLibraryId = this.findNewLibraryId(oldLibInfo, newLookup);

                if (newLibraryId) {
                    await this.db.query(
                        `INSERT INTO library_arr_mappings
                         (library_id, arr_type, arr_config_id, arr_root_folder_id, arr_root_folder_path,
                          quality_profile_id, plex_path_prefix, arr_path_prefix, classifarr_path_prefix)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                         ON CONFLICT (library_id) DO UPDATE SET
                            arr_type = EXCLUDED.arr_type,
                            arr_config_id = EXCLUDED.arr_config_id,
                            arr_root_folder_id = EXCLUDED.arr_root_folder_id,
                            arr_root_folder_path = EXCLUDED.arr_root_folder_path,
                            quality_profile_id = EXCLUDED.quality_profile_id,
                            plex_path_prefix = EXCLUDED.plex_path_prefix,
                            arr_path_prefix = EXCLUDED.arr_path_prefix,
                            classifarr_path_prefix = EXCLUDED.classifarr_path_prefix,
                            updated_at = NOW()`,
                        [
                            newLibraryId,
                            mapping.arr_type,
                            mapping.arr_config_id,
                            mapping.arr_root_folder_id,
                            mapping.arr_root_folder_path,
                            mapping.quality_profile_id,
                            mapping.plex_path_prefix,
                            mapping.arr_path_prefix,
                            mapping.classifarr_path_prefix
                        ]
                    );

                    result.remapped++;

                    this.logger.info('Restored library mapping', {
                        instance: `${type} ${config.id}`,
                        oldId: mapping.library_id,
                        newId: newLibraryId,
                        name: oldLibInfo.name,
                        arr_root_folder: mapping.arr_root_folder_path
                    });
                } else {
                    result.failed++;
                    result.failedLibraries.push({
                        oldId: mapping.library_id,
                        name: oldLibInfo.name,
                        reason: 'No matching library found after re-sync'
                    });
                }
            }

            return result;
        } catch (error) {
            this.logger.error('Failed to remap instance mappings', {
                type,
                configId: config.id,
                error: error.message
            });
            throw error;
        }
    }

    async remapAllArrMappings(oldLibrarySnapshot, newLibraryLookup) {
        const results = {
            radarr: [],
            sonarr: [],
            totalRemapped: 0,
            totalFailed: 0
        };

        try {
            const radarrConfigs = await this.db.query('SELECT * FROM radarr_config');

            for (const config of radarrConfigs.rows) {
                const instanceResult = await this.remapInstanceMappings(
                    'radarr',
                    config,
                    oldLibrarySnapshot,
                    newLibraryLookup
                );

                results.radarr.push({
                    id: config.id,
                    name: config.name || `Radarr ${config.id}`,
                    remapped: instanceResult.remapped,
                    failed: instanceResult.failed,
                    failedLibraries: instanceResult.failedLibraries
                });

                results.totalRemapped += instanceResult.remapped;
                results.totalFailed += instanceResult.failed;
            }

            const sonarrConfigs = await this.db.query('SELECT * FROM sonarr_config');

            for (const config of sonarrConfigs.rows) {
                const instanceResult = await this.remapInstanceMappings(
                    'sonarr',
                    config,
                    oldLibrarySnapshot,
                    newLibraryLookup
                );

                results.sonarr.push({
                    id: config.id,
                    name: config.name || `Sonarr ${config.id}`,
                    remapped: instanceResult.remapped,
                    failed: instanceResult.failed,
                    failedLibraries: instanceResult.failedLibraries
                });

                results.totalRemapped += instanceResult.remapped;
                results.totalFailed += instanceResult.failed;
            }

            this.logger.info('Library mapping restoration complete', {
                totalRemapped: results.totalRemapped,
                totalFailed: results.totalFailed
            });

            return results;
        } catch (error) {
            this.logger.error('Failed to remap all arr mappings', { error: error.message });
            throw error;
        }
    }

    async createRemapFailureNotification(results) {
        if (results.totalFailed === 0) return;

        try {
            const failedDetails = [];

            for (const instance of results.radarr) {
                if (instance.failed > 0) {
                    failedDetails.push({
                        type: 'radarr',
                        instanceId: instance.id,
                        instanceName: instance.name,
                        failedLibraries: instance.failedLibraries
                    });
                }
            }

            for (const instance of results.sonarr) {
                if (instance.failed > 0) {
                    failedDetails.push({
                        type: 'sonarr',
                        instanceId: instance.id,
                        instanceName: instance.name,
                        failedLibraries: instance.failedLibraries
                    });
                }
            }

            await this.db.query(`
                INSERT INTO app_notifications (type, title, message, data, created_at)
                VALUES ($1, $2, $3, $4, NOW())
            `, [
                'warning',
                'Some library mappings need attention',
                `${results.totalFailed} library mapping(s) could not be automatically restored after CARSA. Please review and reconfigure them manually.`,
                JSON.stringify(failedDetails)
            ]);

            this.logger.warn('Created notification for failed mappings', {
                totalFailed: results.totalFailed,
                details: failedDetails
            });
        } catch (error) {
            this.logger.error('Failed to create remap failure notification', { error: error.message });
        }
    }

    async withOptionalTransaction(work, context = 'transaction') {
        return this.db.withTransaction(work).catch((error) => {
            this.logger.warn('Transaction failed', { context, error: error.message });
            throw error;
        });
    }

    isForeignKeyConstraintError(error) {
        const code = typeof error?.code === 'string' ? error.code.trim() : '';
        const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
        return code === '23503' || message.includes('violates foreign key constraint');
    }

    normalizeClearAndResyncError(error) {
        if (error?.code === 'CARSA_DEPENDENCY_CONFLICT' || error?.code === 'CARSA_RESET_FAILED') {
            return error;
        }

        if (this.isForeignKeyConstraintError(error)) {
            const constraint = (error.message || '').match(/constraint "([^"]+)"/i)?.[1] || null;
            const table = (error.message || '').match(/on table "([^"]+)"/i)?.[1] || null;
            const dependencyError = new Error(
                `CARSA blocked by dependent rows${table ? ` on ${table}` : ''}${constraint ? ` (${constraint})` : ''}`
            );
            dependencyError.code = 'CARSA_DEPENDENCY_CONFLICT';
            dependencyError.details = {
                table,
                constraint,
                originalError: error.message || null
            };
            return dependencyError;
        }

        const resetError = new Error(error?.message || 'Failed to clear and resync');
        resetError.code = 'CARSA_RESET_FAILED';
        resetError.details = {
            originalError: error?.message || null
        };
        return resetError;
    }

    async performClearAndResyncCleanup() {
        const transact = typeof this.db.withTransaction === 'function'
            ? (fn) => this.db.withTransaction(fn)
            : (fn) => this.withOptionalTransaction(fn, 'clear_and_resync');

        return transact(async (dbClient) => {
            await dbClient.query('LOCK TABLE libraries, media_server_sync_status IN SHARE ROW EXCLUSIVE MODE');

            this.syncStatus.updateProgress(20, 'Clearing task queue...');
            const queueResult = await dbClient.query('DELETE FROM task_queue RETURNING id');

            await dbClient.query('DELETE FROM content_analysis_log');

            const embeddingsResult = await dbClient.query('DELETE FROM classification_embeddings RETURNING id');
            if ((embeddingsResult.rowCount || 0) > 0) {
                await persistRagAuditLog({
                    client: dbClient,
                    logger: this.logger,
                    type: 'system',
                    message: `CARSA clear-and-resync deleted ${embeddingsResult.rowCount} classification_embeddings row(s) before library rebuild.`,
                });
            }

            this.syncStatus.updateProgress(30, 'Clearing embeddings...');

            const historyResult = await dbClient.query('DELETE FROM classification_history RETURNING id');

            this.syncStatus.updateProgress(40, 'Clearing classification history...');

            const patternsResult = await this.evidenceService.purgeAllLegacyPatterns({
                client: dbClient,
                actor: 'carsa',
                reason: 'clear_and_resync'
            });
            const correctionsResult = await dbClient.query('DELETE FROM classification_corrections RETURNING id');

            this.syncStatus.updateProgress(50, 'Clearing learning data...');

            const rulesV2Result = await dbClient.query('DELETE FROM library_rules_v2 RETURNING id');
            await dbClient.query('DELETE FROM library_custom_rules');
            await dbClient.query('DELETE FROM library_pattern_suggestions');

            this.syncStatus.updateProgress(60, 'Clearing library rules...');

            await dbClient.query('DELETE FROM library_profiles');

            let feedbackLibraryRefsCleared = 0;
            try {
                const feedbackResult = await dbClient.query(`
                    UPDATE policy_feedback_log
                    SET selected_library_id = NULL
                    WHERE selected_library_id IS NOT NULL
                `);
                feedbackLibraryRefsCleared = feedbackResult.rowCount || 0;
            } catch (error) {
                if (error.code !== '42P01') {
                    throw error;
                }
                this.logger.debug('policy_feedback_log not present; skipping selected_library_id cleanup');
            }

            const syncStatusRowsResult = await dbClient.query('DELETE FROM media_server_sync_status RETURNING id');
            const collectionsResult = await dbClient.query('DELETE FROM media_server_collections RETURNING id');
            const itemsResult = await dbClient.query('DELETE FROM media_server_items RETURNING id');

            this.syncStatus.updateProgress(70, 'Clearing media items...');

            const librariesResult = await dbClient.query('DELETE FROM libraries RETURNING id');

            return {
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
            };
        });
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
