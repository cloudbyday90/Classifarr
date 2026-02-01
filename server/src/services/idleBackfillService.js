/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const embeddingService = require('./embeddingService');
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
        let runId = null;
        
        try {
            // Load latest config
            const config = await this.loadConfig();
            
            if (!config) {
                logger.error('Idle backfill NOT started: Failed to load configuration');
                return;
            }

            // Check if RAG is enabled first
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

            // Check for pending items BEFORE setting isRunning
            const pendingCount = await this.getPendingCount();
            if (pendingCount === 0) {
                logger.info('Idle backfill NOT started: No pending embeddings');
                return;
            }

            // Create run record with total BEFORE setting isRunning
            const runResult = await db.query(`
                INSERT INTO backfill_runs (type, status, total)
                VALUES ('idle', 'running', $1)
                RETURNING id
            `, [pendingCount]);
            runId = runResult.rows[0].id;

            // Only set isRunning after database record is successfully created
            this.isRunning = true;
            logger.info('Starting idle backfill...', { pending: pendingCount, runId });

            let totalProcessed = 0;

            try {
                // Note: For optimal performance with multiple models, configure your Ollama:
                // OLLAMA_KEEP_ALIVE=-1 (keep models loaded indefinitely)
                // OLLAMA_MAX_LOADED_MODELS=2 (or more for your model count)
                // The keep_alive parameter on embed requests handles keeping models loaded

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
                            if (error.message === 'PROVIDER_OFFLINE') {
                                logger.warn('Provider offline detected - pausing idle backfill for 5 minutes');
                                await this.sleep(300000); // Wait 5 minutes
                                
                                // Reset idle check so we don't immediately exit if user moved mouse during sleep
                                // but logic will check isIdle() at loop start anyway.
                                // Breaking the inner loop to re-evaluate conditions
                                break; 
                            }

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
        } catch (error) {
            logger.error('Idle backfill startup error', { error: error.message });
            this.isRunning = false;
            
            // Clean up database record if it was created
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
        return {
            isRunning: this.isRunning,
            config: this.config
        };
    }
}

module.exports = new IdleBackfillService();
