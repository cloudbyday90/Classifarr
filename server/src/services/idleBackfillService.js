/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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
    }

    /**
     * Load configuration from database
     */
    async loadConfig() {
        try {
            const result = await db.query(`
                SELECT 
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
     * Get pending embeddings
     */
    async getPendingEmbeddings(limit = 10) {
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
     * Start idle backfill process
     */
    async startIdleBackfill() {
        // Load latest config
        await this.loadConfig();

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

        // Create run record
        const runResult = await db.query(`
            INSERT INTO backfill_runs (type, status)
            VALUES ('idle', 'running')
            RETURNING id
        `);
        const runId = runResult.rows[0].id;

        let totalProcessed = 0;

        try {
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
