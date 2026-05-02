/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const { withSessionAdvisoryLock, DB_ADVISORY_LOCKS } = require('../config/database');
const embeddingService = require('./embeddingService');
const { createLogger } = require('../utils/logger');
const idleDetector = require('../utils/idleDetector');

const logger = createLogger('IdleBackfillService');

async function defaultLoadIdleDetector() {
    return idleDetector;
}

/**
 * IdleBackfillService
 * Performs opportunistic embedding backfill during quiet periods
 */
class IdleBackfillService {
    constructor() {
        this.isRunning = false;
        this.batchSize = 10;
        this.config = null;
        this.manualBackfillService = null;
        this.includeText = true;
        this.includeImage = false;
        this.loadIdleDetector = defaultLoadIdleDetector;
    }

    async getIdleDetector() {
        const loadedIdleDetector = await this.loadIdleDetector();
        return loadedIdleDetector.default || loadedIdleDetector;
    }

    isTextBackfillConfigured(config = {}) {
        const mode = String(config.embedding_provider_mode || 'same').toLowerCase();

        if (mode === 'same') {
            const provider = String(config.primary_provider || '').toLowerCase();
            return provider !== '' && provider !== 'none';
        }

        if (mode === 'separate_ollama') {
            return String(config.embedding_ollama_host || '').trim().length > 0;
        }

        if (mode === 'cloud') {
            return String(config.embedding_cloud_provider || '').trim().length > 0
                && String(config.embedding_cloud_api_key || '').trim().length > 0;
        }

        return false;
    }

    /**
     * Set reference to manual backfill service for status checking
     */
    setManualBackfillService(service) {
        this.manualBackfillService = service;
    }

    /**
     * Load configuration from database
     */
    async loadConfig() {
        try {
            const activeIdleDetector = await this.getIdleDetector();
            const result = await db.query(`
                SELECT 
                    rag_enabled,
                    idle_backfill_enabled,
                    idle_threshold,
                    idle_batch_size,
                    embedding_provider_mode,
                    primary_provider,
                    embedding_ollama_host,
                    embedding_cloud_provider,
                    embedding_cloud_api_key
                FROM ai_provider_config 
                WHERE id = 1
            `);

            if (result.rows.length > 0) {
                this.config = result.rows[0];
                this.batchSize = this.config.idle_batch_size || 10;

                if (this.config.idle_threshold) {
                    activeIdleDetector.setIdleThreshold(this.config.idle_threshold);
                }
            } else {
                this.config = { rag_enabled: false, idle_backfill_enabled: false };
            }

            return this.config;
        } catch (error) {
            logger.error('Failed to load idle backfill config', { error: error.message });
            return null;
        }
    }

    /**
     * Get pending embeddings count
     */
    async getPendingCount() {
        return await embeddingService.getPendingCount({
            includeText: this.includeText,
            includeImage: this.includeImage
        });
    }

    /**
     * Get pending embeddings
     */
    async getPendingEmbeddings(limit = 10) {
        return await embeddingService.getPendingEmbeddings({
            limit,
            includeText: this.includeText,
            includeImage: this.includeImage
        });
    }

    /**
     * Start idle backfill process
     */
    async startIdleBackfill() {
        let runId = null;

        try {
            const activeIdleDetector = await this.getIdleDetector();
            const config = await this.loadConfig();

            if (!config) {
                logger.warn('Idle backfill NOT started: configuration could not be loaded (DB error)');
                return;
            }

            if (!config.rag_enabled) {
                logger.info('Idle backfill NOT started: RAG is disabled in settings');
                return;
            }

            if (!config.idle_backfill_enabled) {
                logger.info('Idle backfill NOT started: Idle backfill is disabled in settings');
                return;
            }

            if (this.isRunning) {
                logger.info('Idle backfill NOT started: Already running');
                return;
            }

            const availability = await embeddingService.getProviderAvailabilityStatus({ refresh: true });
            if (availability.status === 'cooldown' || availability.status === 'probing') {
                logger.info('Idle backfill NOT started: Provider offline cooldown active', {
                    retryAt: availability.cooldownUntil
                });
                return;
            }

            const lockAcquired = await withSessionAdvisoryLock(
                DB_ADVISORY_LOCKS.BACKFILL_OWNER,
                async () => {
                    this.includeText = this.isTextBackfillConfigured(config);
                    this.includeImage = await embeddingService.shouldIncludeImageEmbeddings();

                    if (!this.includeText && !this.includeImage) {
                        logger.info('Idle backfill NOT started: text and image embedding providers are not configured');
                        return;
                    }

                    const pendingCount = await this.getPendingCount();
                    if (pendingCount === 0) {
                        logger.info('Idle backfill NOT started: No pending embeddings');
                        return;
                    }

                    const runResult = await db.query(`
                        INSERT INTO backfill_runs (type, status, total)
                        VALUES ('idle', 'running', $1)
                        RETURNING id
                    `, [pendingCount]);
                    runId = runResult.rows[0].id;

                    this.isRunning = true;
                    logger.info('Starting idle backfill...', { pending: pendingCount, runId });

                    let totalProcessed = 0;
                    let deferredForBusy = false;

                    try {
                        while (this.isRunning && activeIdleDetector.isIdle()) {
                            const pending = await this.getPendingEmbeddings(this.batchSize);

                            if (pending.length === 0) {
                                logger.info('No pending embeddings, idle backfill complete');
                                break;
                            }

                            for (const item of pending) {
                                if (!activeIdleDetector.isIdle()) {
                                    logger.info('Classification activity detected, pausing idle backfill');
                                    break;
                                }

                                if (this.manualBackfillService) {
                                    const manualStatus = await this.manualBackfillService.getStatus();
                                    if (manualStatus.status === 'running') {
                                        logger.info('Manual backfill started, stopping idle backfill');
                                        break;
                                    }
                                }

                                if (!this.isRunning) {
                                    break;
                                }

                                try {
                                    let generationResult = null;
                                    if (item.needsText) {
                                        generationResult = await embeddingService.generateAndStore(item.id, {
                                            ...item.metadata,
                                            title: item.title,
                                            media_type: item.media_type,
                                            library_name: item.library_name
                                        });
                                    } else if (item.needsImage) {
                                        generationResult = await embeddingService.generateImageEmbedding(item.id, {
                                            ...item.metadata,
                                            title: item.title,
                                            media_type: item.media_type,
                                            library_name: item.library_name
                                        });
                                    }

                                    if (!generationResult) {
                                        logger.debug('Idle backfill item was not stored; leaving it pending', {
                                            id: item.id,
                                            title: item.title
                                        });
                                        continue;
                                    }

                                    totalProcessed++;

                                    await db.query(
                                        'UPDATE backfill_runs SET processed = $1 WHERE id = $2',
                                        [totalProcessed, runId]
                                    );
                                } catch (error) {
                                    if (error.message === 'PROVIDER_OFFLINE') {
                                        const offlineStatus = embeddingService.getProviderAvailabilityStatus();
                                        logger.warn('Provider offline detected - deferring idle backfill until recovery probe succeeds', {
                                            retryAt: offlineStatus.cooldownUntil
                                        }, { skipDbPersist: true });

                                        this.isRunning = false;
                                        break;
                                    }

                                    if (embeddingService.isProviderBusyError(error)) {
                                        deferredForBusy = true;
                                        logger.info('Idle backfill yielded to active provider traffic', {
                                            id: item.id,
                                            title: item.title,
                                            lockHolder: error.lockHolder || null,
                                            waitMs: error.waitMs || null,
                                            activeModel: error.activeModel || null
                                        });
                                        this.isRunning = false;
                                        break;
                                    }

                                    logger.error('Failed to generate embedding in idle backfill', {
                                        id: item.id,
                                        title: item.title,
                                        error: error.message
                                    }, { error });
                                }
                            }

                            if (this.isRunning && activeIdleDetector.isIdle()) {
                                await this.sleep(1000);
                            }
                        }

                        await db.query(`
                            UPDATE backfill_runs 
                            SET status = 'completed', 
                                completed_at = NOW(),
                                processed = $1
                            WHERE id = $2
                        `, [totalProcessed, runId]);

                        logger.info('Idle backfill completed', {
                            processed: totalProcessed,
                            deferredForBusy
                        });
                    } catch (error) {
                        logger.error('Idle backfill error', { error: error.message }, { error });

                        await db.query(`
                            UPDATE backfill_runs 
                            SET status = 'failed', 
                                completed_at = NOW(),
                                error = $1,
                                processed = $2
                            WHERE id = $3
                        `, [error.message, totalProcessed, runId]);
                    } finally {
                        this.isRunning = false;
                    }
                }
            );
            if (!lockAcquired) {
                logger.info('Idle backfill skipped: another backfill mode already owns the worker');
            }
        } catch (error) {
            logger.error('Idle backfill startup error', { error: error.message });
            this.isRunning = false;

            if (runId) {
                try {
                    await db.query(`
                        UPDATE backfill_runs 
                        SET status = 'failed', 
                            completed_at = NOW(),
                            error = $1
                        WHERE id = $2
                    `, [error.message, runId]);
                } catch (dbError) {
                    logger.error('Failed to update backfill run status', { error: dbError.message });
                }
            }
            return;
        }
    }

    /**
     * Stop idle backfill
     */
    stopIdleBackfill() {
        if (this.isRunning) {
            logger.info('Stopping idle backfill');
            this.isRunning = false;
        }
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get current status
     */
    getStatus() {
        const enabled = this.config?.idle_backfill_enabled === true;
        const availability = embeddingService.getProviderAvailabilityStatus();
        const cooldownActive = availability.status === 'cooldown' || availability.status === 'probing';
        const status = this.isRunning
            ? 'running'
            : cooldownActive
                ? 'cooldown'
                : enabled
                    ? 'enabled'
                    : 'disabled';

        return {
            status,
            enabled,
            isRunning: this.isRunning,
            batchSize: this.batchSize,
            includeImage: this.includeImage,
            cooldownUntil: cooldownActive ? availability.cooldownUntil : null,
            config: this.config
        };
    }
}

module.exports = new IdleBackfillService();
