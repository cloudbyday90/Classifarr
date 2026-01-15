/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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
            runId: null
        };
        this.isProcessing = false; // Flag to prevent concurrent runBackfill() calls
    }

    /**
     * Get count of pending embeddings
     */
    async getPendingCount() {
        try {
            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM classification_history ch
                LEFT JOIN classification_embeddings ce ON ch.id = ce.classification_id
                WHERE ce.id IS NULL
                AND ch.library_id IS NOT NULL
            `);

            return parseInt(result.rows[0].count) || 0;
        } catch (error) {
            logger.error('Failed to get pending count', { error: error.message });
            return 0;
        }
    }

    /**
     * Get pending embeddings
     */
    async getPendingEmbeddings(limit) {
        try {
            const result = await db.query(`
                SELECT ch.id, ch.title, ch.media_type, ch.library_name, ch.metadata
                FROM classification_history ch
                LEFT JOIN classification_embeddings ce ON ch.id = ce.classification_id
                WHERE ce.id IS NULL
                AND ch.library_id IS NOT NULL
                ORDER BY ch.created_at DESC
                LIMIT $1
            `, [limit]);

            return result.rows.map(row => ({
                id: row.id,
                title: row.title,
                media_type: row.media_type,
                library_name: row.library_name,
                metadata: typeof row.metadata === 'string' 
                    ? JSON.parse(row.metadata) 
                    : row.metadata
            }));
        } catch (error) {
            logger.error('Failed to get pending embeddings', { error: error.message });
            return [];
        }
    }

    /**
     * Start manual backfill
     */
    async start(options = {}) {
        if (this.state.status === 'running') {
            throw new Error('Backfill already running');
        }

        this.state.batchSize = options.batchSize || 50;
        this.state.total = await this.getPendingCount();
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

        return this.getStatus();
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

                const pending = await this.getPendingEmbeddings(this.state.batchSize);
                
                if (pending.length === 0) {
                    logger.info('No more pending embeddings');
                    break;
                }

                for (const item of pending) {
                    if (this.state.status !== 'running') {
                        break;
                    }

                    try {
                        await embeddingService.generateAndStore(item.id, {
                            ...item.metadata,
                            title: item.title,
                            media_type: item.media_type,
                            library_name: item.library_name
                        });
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
            runId: null
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
            this.state.eta = Math.round(remaining * avgTimePerItem / 1000); // seconds
        }
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            ...this.state,
            progress: this.state.total > 0 
                ? Math.round((this.state.processed / this.state.total) * 100) 
                : 0
        };
    }
}

module.exports = new ManualBackfillService();
