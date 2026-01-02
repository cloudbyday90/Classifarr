/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const embeddingService = require('./embeddingService');
const embeddingRouter = require('./embeddingRouter');
const { createLogger } = require('../utils/logger');
const ragLogger = require('../utils/ragLogger');

const logger = createLogger('EmbeddingMigration');

/**
 * Embedding Migration Service
 * Handles background re-embedding when format version changes
 */
class EmbeddingMigrationService {
    constructor() {
        this.isRunning = false;
        this.progress = {
            total: 0,
            completed: 0,
            failed: 0,
            startedAt: null,
            estimatedCompletion: null
        };
    }

    /**
     * Check if migration is needed and start if configured to auto-start
     * Called on server startup
     */
    async checkAndStartMigration() {
        try {
            const config = await embeddingRouter.getConfig();
            
            // Check if embedding format version matches
            const mismatch = await embeddingService.checkEmbeddingVersionMismatch();
            
            if (mismatch) {
                logger.info('Embedding format version mismatch detected', {
                    configVersion: config?.embedding_format_version || 2,
                    currentVersion: embeddingService.EMBEDDING_FORMAT_VERSION
                });

                // Auto-start migration if RAG is enabled
                if (config?.rag_enabled) {
                    logger.info('Auto-starting embedding migration');
                    // Start in background, don't wait
                    this.startBackgroundMigration().catch(error => {
                        logger.error('Background migration failed', { error: error.message });
                    });
                } else {
                    logger.info('RAG disabled, skipping auto-migration');
                }
            } else {
                logger.debug('Embedding format version is up to date');
            }
        } catch (error) {
            logger.error('Failed to check migration status', { error: error.message });
        }
    }

    /**
     * Mark all existing embeddings for re-embedding
     * @returns {Promise<number>} Number of embeddings marked
     */
    async markAllForReembedding() {
        try {
            const result = await db.query(`
                UPDATE classification_embeddings 
                SET is_stale = true
                WHERE is_stale = false
            `);

            logger.info('Marked embeddings for re-embedding', { count: result.rowCount });
            return result.rowCount;
        } catch (error) {
            logger.error('Failed to mark embeddings for re-embedding', { error: error.message });
            throw error;
        }
    }

    /**
     * Start background migration process
     * Processes in batches to avoid overwhelming the system
     */
    async startBackgroundMigration() {
        if (this.isRunning) {
            logger.warn('Migration already running');
            return;
        }

        try {
            this.isRunning = true;
            this.progress.startedAt = new Date();

            // Get total count of stale embeddings
            const countResult = await db.query(`
                SELECT COUNT(*) as total
                FROM classification_embeddings ce
                JOIN classification_history ch ON ce.classification_id = ch.id
                WHERE ce.is_stale = true
            `);
            
            this.progress.total = parseInt(countResult.rows[0].total) || 0;
            this.progress.completed = 0;
            this.progress.failed = 0;

            if (this.progress.total === 0) {
                logger.info('No stale embeddings to migrate');
                this.isRunning = false;
                return;
            }

            logger.info('Starting background migration', {
                total: this.progress.total
            });

            // Process in batches of 10
            const batchSize = 10;
            const delayBetweenBatches = 30000; // 30 seconds between batches (~120/hour)

            while (this.progress.completed + this.progress.failed < this.progress.total && this.isRunning) {
                await this.processBatch(batchSize);
                
                // Update estimated completion
                if (this.progress.completed > 0) {
                    const elapsed = Date.now() - this.progress.startedAt.getTime();
                    const avgTimePerItem = elapsed / this.progress.completed;
                    const remaining = this.progress.total - this.progress.completed - this.progress.failed;
                    const estimatedMs = remaining * avgTimePerItem;
                    this.progress.estimatedCompletion = new Date(Date.now() + estimatedMs);
                }

                // Wait before next batch
                if (this.progress.completed + this.progress.failed < this.progress.total) {
                    await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
                }
            }

            logger.info('Background migration completed', {
                total: this.progress.total,
                completed: this.progress.completed,
                failed: this.progress.failed
            });

        } catch (error) {
            logger.error('Background migration error', { error: error.message });
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Process a batch of stale embeddings
     * @param {number} batchSize - Number of items to process
     */
    async processBatch(batchSize) {
        try {
            // Get batch of stale embeddings
            const result = await db.query(`
                SELECT 
                    ce.classification_id,
                    ch.title,
                    ch.media_type,
                    ch.library_name,
                    ch.metadata
                FROM classification_embeddings ce
                JOIN classification_history ch ON ce.classification_id = ch.id
                WHERE ce.is_stale = true
                ORDER BY ce.updated_at ASC
                LIMIT $1
            `, [batchSize]);

            for (const row of result.rows) {
                try {
                    const metadata = typeof row.metadata === 'string'
                        ? JSON.parse(row.metadata)
                        : row.metadata;

                    await embeddingService.generateAndStore(row.classification_id, {
                        ...metadata,
                        title: row.title,
                        media_type: row.media_type,
                        library_name: row.library_name
                    });

                    this.progress.completed++;
                    
                    logger.debug('Re-embedded classification', {
                        id: row.classification_id,
                        title: row.title,
                        progress: `${this.progress.completed}/${this.progress.total}`
                    });
                } catch (error) {
                    this.progress.failed++;
                    logger.warn('Failed to re-embed classification', {
                        id: row.classification_id,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            logger.error('Failed to process batch', { error: error.message });
        }
    }

    /**
     * Get migration progress
     * @returns {object} Current migration progress
     */
    getProgress() {
        return {
            ...this.progress,
            isRunning: this.isRunning,
            percentComplete: this.progress.total > 0 
                ? Math.round((this.progress.completed / this.progress.total) * 100)
                : 0
        };
    }

    /**
     * Stop the migration process
     */
    stopMigration() {
        if (this.isRunning) {
            logger.info('Stopping migration');
            this.isRunning = false;
        }
    }
}

module.exports = new EmbeddingMigrationService();
