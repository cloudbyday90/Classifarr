/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const embeddingService = require('./embeddingService');
const ollamaService = require('./ollama');
const idleDetector = require('../utils/idleDetector');
const { createLogger } = require('../utils/logger');

const logger = createLogger('IdleBackfillService');

/**
 * IdleBackfillService
 * Performs opportunistic embedding backfill during quiet periods
 */
class IdleBackfillService {
    constructor() {
        this.isRunning = false;
        this.batchSize = 10;
        this.config = null;
        this.manualBackfillService = null; // Will be set by orchestrator
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
            const result = await db.query(`
                SELECT 
                    rag_enabled,
                    idle_backfill_enabled,
                    idle_threshold,
                    idle_batch_size
                FROM ai_provider_config 
                WHERE id = 1
            `);

            if (result.rows.length > 0) {
                this.config = result.rows[0];
                this.batchSize = this.config.idle_batch_size || 10;

                // Update idle detector threshold
                if (this.config.idle_threshold) {
                    idleDetector.setIdleThreshold(this.config.idle_threshold);
                }
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
        try {
            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM classification_history ch
                WHERE NOT EXISTS (
                    SELECT 1 FROM classification_embeddings ce
                    WHERE ce.classification_id = ch.id
                )
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
    async getPendingEmbeddings(limit = 10) {
        try {
            const result = await db.query(`
                SELECT ch.id, ch.title, ch.media_type, ch.library_name, ch.metadata
                FROM classification_history ch
                WHERE NOT EXISTS (
                    SELECT 1 FROM classification_embeddings ce
                    WHERE ce.classification_id = ch.id
                )
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
     * Start idle backfill process
     */
    async startIdleBackfill() {
        // Load latest config
        await this.loadConfig();

        // Check if RAG is enabled first
        if (!this.config?.rag_enabled) {
            logger.debug('RAG is not enabled, skipping idle backfill');
            return;
        }

        if (!this.config?.idle_backfill_enabled) {
            logger.debug('Idle backfill is disabled');
            return;
        }

        if (this.isRunning) {
            logger.debug('Idle backfill already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting idle backfill');

        // Get initial pending count
        const initialPending = await this.getPendingCount();

        // Create run record with total
        const runResult = await db.query(`
            INSERT INTO backfill_runs (type, status, total)
            VALUES ('idle', 'running', $1)
            RETURNING id
        `, [initialPending]);
        const runId = runResult.rows[0].id;

        let totalProcessed = 0;

        try {
            // Phase 4: Smart Batching - Preload embedding model before starting batch
            // This avoids model swapping for each embedding request
            const embeddingConfig = await db.query(`
                SELECT embedding_model, embedding_provider_mode, embedding_ollama_host
                FROM ai_provider_config WHERE id = 1
            `);

            if (embeddingConfig.rows.length > 0) {
                const { embedding_model, embedding_provider_mode, embedding_ollama_host } = embeddingConfig.rows[0];

                // Only preload if using "same" mode (shared Ollama)
                if (embedding_provider_mode === 'same' && embedding_model) {
                    const isLoaded = await ollamaService.isModelLoaded(embedding_model);

                    if (!isLoaded) {
                        logger.info('Preloading embedding model before batch', { model: embedding_model });
                        const preloaded = await ollamaService.preloadModel(embedding_model, '30m');

                        if (preloaded) {
                            logger.info('Embedding model preloaded successfully', { model: embedding_model });
                        } else {
                            logger.warn('Failed to preload embedding model, continuing anyway', { model: embedding_model });
                        }
                    } else {
                        logger.debug('Embedding model already loaded', { model: embedding_model });
                    }
                }
            }
            while (this.isRunning && idleDetector.isIdle()) {
                const pending = await this.getPendingEmbeddings(this.batchSize);

                if (pending.length === 0) {
                    logger.info('No pending embeddings, idle backfill complete');
                    break;
                }

                for (const item of pending) {
                    // Check if still idle before each item
                    if (!idleDetector.isIdle()) {
                        logger.info('Classification activity detected, pausing idle backfill');
                        break;
                    }

                    // Check if manual backfill has started
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
                        await embeddingService.generateAndStore(item.id, {
                            ...item.metadata,
                            title: item.title,
                            media_type: item.media_type,
                            library_name: item.library_name
                        });
                        totalProcessed++;

                        // Update run progress
                        await db.query(
                            'UPDATE backfill_runs SET processed = $1 WHERE id = $2',
                            [totalProcessed, runId]
                        );
                    } catch (error) {
                        logger.error('Failed to generate embedding in idle backfill', {
                            id: item.id,
                            title: item.title,
                            error: error.message
                        });
                    }
                }

                // Brief pause between batches
                if (this.isRunning && idleDetector.isIdle()) {
                    await this.sleep(1000);
                }
            }

            // Mark as completed
            await db.query(`
                UPDATE backfill_runs 
                SET status = 'completed', 
                    completed_at = NOW(),
                    processed = $1
                WHERE id = $2
            `, [totalProcessed, runId]);

            logger.info('Idle backfill completed', { processed: totalProcessed });
        } catch (error) {
            logger.error('Idle backfill error', { error: error.message });

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
        return {
            isRunning: this.isRunning,
            config: this.config
        };
    }
}

module.exports = new IdleBackfillService();
