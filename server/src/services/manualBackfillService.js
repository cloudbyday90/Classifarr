/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const embeddingService = require('./embeddingService');
const embeddingProvider = require('./embeddingProvider');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ManualBackfillService');

/**
 * ManualBackfillService
 * Handles user-triggered on-demand backfill with progress controls
 */
class ManualBackfillService {
    constructor() {
        this.state = {
            status: 'idle', // 'idle' | 'running' | 'paused' | 'completed'
            processed: 0,
            total: 0,
            startTime: null,
            eta: null,
            batchSize: 50,
            error: null,
            runId: null,
            includeImage: false
        };
        this.isProcessing = false; // Flag to prevent concurrent runBackfill() calls
    }

    /**
     * Get count of pending embeddings
     */
    async getPendingCount(includeImage = null) {
        const resolvedIncludeImage = includeImage ?? await embeddingService.shouldIncludeImageEmbeddings();
        return await embeddingService.getPendingCount({ includeImage: resolvedIncludeImage });
    }

    /**
     * Get pending embeddings
     */
    async getPendingEmbeddings(limit, includeImage = null) {
        const resolvedIncludeImage = includeImage ?? await embeddingService.shouldIncludeImageEmbeddings();
        return await embeddingService.getPendingEmbeddings({
            limit,
            includeImage: resolvedIncludeImage
        });
    }

    /**
     * Start manual backfill
     */
    async start(options = {}) {
        // Check if RAG is enabled before starting
        const configResult = await db.query('SELECT rag_enabled FROM ai_provider_config WHERE id = 1');
        if (!configResult.rows[0]?.rag_enabled) {
            throw new Error('RAG is not enabled. Please enable RAG in settings before running backfill.');
        }

        if (this.state.status === 'running') {
            throw new Error('Backfill already running');
        }

        this.state.batchSize = options.batchSize || 50;
        this.state.includeImage = await embeddingService.shouldIncludeImageEmbeddings();
        this.state.total = await this.getPendingCount(this.state.includeImage);
        this.state.processed = 0;
        this.state.startTime = Date.now();
        this.state.status = 'running';
        this.state.error = null;
        this.state.eta = null;

        logger.info('Manual backfill started', {
            total: this.state.total,
            batchSize: this.state.batchSize
        });

        // Create run record
        const runResult = await db.query(`
            INSERT INTO backfill_runs (type, status, total)
            VALUES ('manual', 'running', $1)
            RETURNING id
        `, [this.state.total]);
        this.state.runId = runResult.rows[0].id;

        // Run in background
        this.runBackfill().catch(error => {
            logger.error('Manual backfill error', { error: error.message });
            this.state.error = error.message;
            this.state.status = 'failed';
        });

        return await this.getStatus();
    }

    /**
     * Run backfill process
     */
    async runBackfill() {
        // Prevent concurrent execution
        if (this.isProcessing) {
            logger.warn('runBackfill() already in progress, skipping');
            return;
        }

        this.isProcessing = true;
        try {
            // Warmup model before starting batch
            logger.info('Warming up embedding model before batch processing');
            try {
                await embeddingProvider.warmup();
            } catch (error) {
                logger.warn('Model warmup failed, continuing anyway', { error: error.message });
            }

            while (this.state.status === 'running' && this.state.processed < this.state.total) {
                // Check circuit breaker status
                const circuitStatus = embeddingProvider.circuitBreaker.getStatus();
                if (circuitStatus.state === 'OPEN') {
                    logger.warn('Circuit breaker is OPEN, pausing backfill');
                    this.state.status = 'paused';
                    this.state.error = 'Circuit breaker OPEN - too many failures. Please reset and try again.';
                    break;
                }

                const pending = await this.getPendingEmbeddings(this.state.batchSize, this.state.includeImage);

                if (pending.length === 0) {
                    logger.info('No more pending embeddings');
                    break;
                }

                for (const item of pending) {
                    if (this.state.status !== 'running') {
                        break;
                    }

                    try {
                        if (item.needsText) {
                            await embeddingService.generateAndStore(item.id, {
                                ...item.metadata,
                                title: item.title,
                                media_type: item.media_type,
                                library_name: item.library_name
                            });
                        } else if (item.needsImage) {
                            await embeddingService.generateImageEmbedding(item.id, {
                                ...item.metadata,
                                title: item.title,
                                media_type: item.media_type,
                                library_name: item.library_name
                            });
                        }
                        this.state.processed++;
                        this.updateETA();

                        // Update database every 5 items
                        if (this.state.processed % 5 === 0) {
                            await db.query(
                                'UPDATE backfill_runs SET processed = $1 WHERE id = $2',
                                [this.state.processed, this.state.runId]
                            );
                        }
                    } catch (error) {
                        logger.error('Failed to generate embedding', {
                            id: item.id,
                            title: item.title,
                            error: error.message
                        });
                        const itemErrorMessage = `Item ${item.id}: ${error.message}`;
                        if (this.state.error) {
                            this.state.error += ` | ${itemErrorMessage}`;
                        } else {
                            this.state.error = itemErrorMessage;
                        }
                    }
                }
            }

            if (this.state.status === 'running') {
                this.state.status = 'completed';

                await db.query(`
                    UPDATE backfill_runs 
                    SET status = 'completed', 
                        completed_at = NOW(),
                        processed = $1
                    WHERE id = $2
                `, [this.state.processed, this.state.runId]);

                logger.info('Manual backfill completed', { processed: this.state.processed });
            }
        } catch (error) {
            logger.error('Backfill run error', { error: error.message });
            this.state.error = error.message;
            this.state.status = 'failed';

            if (this.state.runId) {
                await db.query(`
                    UPDATE backfill_runs 
                    SET status = 'failed', 
                        completed_at = NOW(),
                        error = $1,
                        processed = $2
                    WHERE id = $3
                `, [error.message, this.state.processed, this.state.runId]);
            }
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Pause backfill
     */
    pause() {
        if (this.state.status === 'running') {
            this.state.status = 'paused';
            logger.info('Manual backfill paused', { processed: this.state.processed });

            if (this.state.runId) {
                db.query(
                    'UPDATE backfill_runs SET status = $1 WHERE id = $2',
                    ['paused', this.state.runId]
                ).catch(err => logger.error('Failed to update run status', { error: err.message }));
            }
        }
    }

    /**
     * Resume backfill
     */
    async resume() {
        if (this.state.status === 'paused') {
            this.state.status = 'running';
            logger.info('Manual backfill resumed', { processed: this.state.processed });

            if (this.state.runId) {
                await db.query(
                    'UPDATE backfill_runs SET status = $1 WHERE id = $2',
                    ['running', this.state.runId]
                );
            }

            // Continue running
            this.runBackfill().catch(error => {
                logger.error('Resume backfill error', { error: error.message });
                this.state.error = error.message;
                this.state.status = 'failed';
            });
        }
    }

    /**
     * Clear/reset backfill state
     */
    async clear() {
        this.state = {
            status: 'idle',
            processed: 0,
            total: 0,
            startTime: null,
            eta: null,
            batchSize: 50,
            error: null,
            runId: null,
            includeImage: false
        };
        this.isProcessing = false;
        logger.info('Manual backfill state cleared');
    }

    /**
     * Update ETA calculation
     */
    updateETA() {
        if (this.state.processed > 0) {
            const elapsed = Date.now() - this.state.startTime;
            const avgTimePerItem = elapsed / this.state.processed;
            const remaining = this.state.total - this.state.processed;
            // Ensure ETA is never negative
            this.state.eta = Math.max(0, Math.round(remaining * avgTimePerItem / 1000)); // seconds
        }
    }

    /**
     * Get current status
     */
    async getStatus() {
        // Dynamically calculate total to handle items added during backfill
        const includeImage = this.state.status === 'running' || this.state.status === 'paused'
            ? this.state.includeImage
            : await embeddingService.shouldIncludeImageEmbeddings();
        const currentPending = await this.getPendingCount(includeImage);
        // Calculate dynamic total as processed + pending to account for items
        // that may have been added during the backfill process (e.g., new classifications)
        const dynamicTotal = this.state.processed + currentPending;
        
        // Use the larger of initial total or dynamic total to avoid progress going backwards
        const total = Math.max(this.state.total, dynamicTotal);
        
        // Clamp processed value to never exceed total (prevents progress > 100%)
        const clampedProcessed = Math.min(this.state.processed, total);
        
        return {
            ...this.state,
            total: total,
            progress: total > 0
                ? Math.round((clampedProcessed / total) * 100)
                : 0
        };
    }
}

module.exports = new ManualBackfillService();
