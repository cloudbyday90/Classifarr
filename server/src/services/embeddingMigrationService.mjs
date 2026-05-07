/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import * as db from '../config/database.mjs';
import { embeddingService } from './embeddingService.mjs';
import { embeddingRouter } from './embeddingRouter.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('EmbeddingMigration');

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

    async checkAndStartMigration() {
        try {
            const config = await embeddingRouter.getConfig();
            const mismatch = await embeddingService.checkEmbeddingVersionMismatch();

            if (mismatch) {
                logger.info('Embedding format version mismatch detected', {
                    configVersion: config?.embedding_format_version || 2,
                    currentVersion: embeddingService.EMBEDDING_FORMAT_VERSION
                });

                if (config?.rag_enabled) {
                    logger.info('Auto-starting embedding migration');
                    this.startBackgroundMigration().catch(error => {
                        logger.error('Background migration failed', { error: error.message }, { error });
                    });
                } else {
                    logger.info('RAG disabled, skipping auto-migration');
                }
            } else {
                logger.debug('Embedding format version is up to date');
            }
        } catch (error) {
            logger.error('Failed to check migration status', { error: error.message }, { error });
        }
    }

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
            logger.error('Failed to mark embeddings for re-embedding', { error: error.message }, { error });
            throw error;
        }
    }

    async startBackgroundMigration() {
        if (this.isRunning) {
            logger.warn('Migration already running');
            return;
        }

        try {
            this.isRunning = true;
            this.progress.startedAt = new Date();

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

            const batchSize = 10;
            const delayBetweenBatches = 30000;
            let deferredReason = null;

            while (this.progress.completed + this.progress.failed < this.progress.total && this.isRunning) {
                const batchResult = await this.processBatch(batchSize);
                if (batchResult?.deferredReason) {
                    deferredReason = batchResult.deferredReason;
                    break;
                }

                if (this.progress.completed > 0) {
                    const elapsed = Date.now() - this.progress.startedAt.getTime();
                    const avgTimePerItem = elapsed / this.progress.completed;
                    const remaining = this.progress.total - this.progress.completed - this.progress.failed;
                    const estimatedMs = remaining * avgTimePerItem;
                    this.progress.estimatedCompletion = new Date(Date.now() + estimatedMs);
                }

                if (this.isRunning && this.progress.completed + this.progress.failed < this.progress.total) {
                    await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
                }
            }

            logger.info('Background migration completed', {
                total: this.progress.total,
                completed: this.progress.completed,
                failed: this.progress.failed,
                deferredReason
            });
        } catch (error) {
            logger.error('Background migration error', { error: error.message }, { error });
        } finally {
            this.isRunning = false;
        }
    }

    async processBatch(batchSize) {
        try {
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

                    const generationResult = await embeddingService.generateAndStore(row.classification_id, {
                        ...metadata,
                        title: row.title,
                        media_type: row.media_type,
                        library_name: row.library_name
                    });

                    if (!generationResult) {
                        logger.debug('Migration item was not stored; leaving it stale', {
                            id: row.classification_id,
                            title: row.title
                        });
                        continue;
                    }

                    this.progress.completed++;

                    logger.debug('Re-embedded classification', {
                        id: row.classification_id,
                        title: row.title,
                        progress: `${this.progress.completed}/${this.progress.total}`
                    });
                } catch (error) {
                    if (error.message === 'PROVIDER_OFFLINE') {
                        const availability = embeddingService.getProviderAvailabilityStatus();
                        logger.info('Background migration deferred: embedding provider unavailable', {
                            retryAt: availability.cooldownUntil || null
                        }, { skipDbPersist: true });
                        this.isRunning = false;
                        return { deferredReason: 'provider_unavailable' };
                    }

                    if (embeddingService.isProviderBusyError(error)) {
                        logger.info('Background migration yielded to active provider traffic', {
                            id: row.classification_id,
                            title: row.title,
                            lockHolder: error.lockHolder || null,
                            waitMs: error.waitMs || null,
                            activeModel: error.activeModel || null
                        });
                        this.isRunning = false;
                        return { deferredReason: 'provider_busy' };
                    }

                    this.progress.failed++;
                    logger.warn('Failed to re-embed classification', {
                        id: row.classification_id,
                        error: error.message
                    }, { error });
                }
            }

            return { deferredReason: null };
        } catch (error) {
            logger.error('Failed to process batch', { error: error.message }, { error });
            return { deferredReason: null };
        }
    }

    getProgress() {
        return {
            ...this.progress,
            isRunning: this.isRunning,
            percentComplete: this.progress.total > 0
                ? Math.round((this.progress.completed / this.progress.total) * 100)
                : 0
        };
    }

    stopMigration() {
        if (this.isRunning) {
            logger.info('Stopping migration');
            this.isRunning = false;
        }
    }
}

export const embeddingMigrationService = new EmbeddingMigrationService();

export { EmbeddingMigrationService };
