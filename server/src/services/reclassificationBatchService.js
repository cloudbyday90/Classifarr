/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const db = require('../config/database');
const reclassificationService = require('./reclassificationService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ReclassificationBatchService');

/**
 * Reclassification Batch Service
 * Handles batch operations for re-classifying multiple media items
 * 
 * Features:
 * - Pre-flight validation before execution
 * - Progress tracking
 * - Pause-on-error capability
 * - Skip, retry, or cancel failed items
 */
class ReclassificationBatchService {
    constructor() {
        this.initialized = false;
    }

    /**
     * Ensure batch tables exist (called on first use)
     */
    async ensureTables() {
        if (this.initialized) return;

        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS reclassification_batches (
                    id SERIAL PRIMARY KEY,
                    status VARCHAR(50) DEFAULT 'pending',
                    total_items INTEGER DEFAULT 0,
                    completed_items INTEGER DEFAULT 0,
                    failed_items INTEGER DEFAULT 0,
                    skipped_items INTEGER DEFAULT 0,
                    paused_at_item INTEGER DEFAULT NULL,
                    pause_on_error BOOLEAN DEFAULT true,
                    created_by VARCHAR(100) DEFAULT 'user',
                    error_message TEXT DEFAULT NULL,
                    started_at TIMESTAMP DEFAULT NULL,
                    completed_at TIMESTAMP DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            await db.query(`
                CREATE TABLE IF NOT EXISTS reclassification_batch_items (
                    id SERIAL PRIMARY KEY,
                    batch_id INTEGER REFERENCES reclassification_batches(id) ON DELETE CASCADE,
                    classification_id INTEGER NOT NULL,
                    target_library_id INTEGER NOT NULL,
                    status VARCHAR(50) DEFAULT 'pending',
                    validation_result JSONB DEFAULT NULL,
                    execution_result JSONB DEFAULT NULL,
                    error_message TEXT DEFAULT NULL,
                    execution_order INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // Create indexes if they don't exist
            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_batch_items_batch_id ON reclassification_batch_items(batch_id)
            `);
            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_batch_items_status ON reclassification_batch_items(status)
            `);

            this.initialized = true;
            logger.info('Reclassification batch tables initialized');
        } catch (error) {
            logger.error('Failed to initialize batch tables', { error: error.message });
            throw error;
        }
    }

    /**
     * Create a new batch from an array of items
     * @param {Array<{classificationId: number, targetLibraryId: number}>} items - Items to reclassify
     * @param {Object} options - Batch options
     * @returns {Promise<Object>} Created batch with items
     */
    async createBatch(items, options = {}) {
        await this.ensureTables();

        const { pauseOnError = true, createdBy = 'user' } = options;

        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('Items array is required and must not be empty');
        }

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // Create batch
            const batchResult = await client.query(`
                INSERT INTO reclassification_batches (status, total_items, pause_on_error, created_by)
                VALUES ('pending', $1, $2, $3)
                RETURNING *
            `, [items.length, pauseOnError, createdBy]);

            const batch = batchResult.rows[0];

            // Insert items
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                await client.query(`
                    INSERT INTO reclassification_batch_items 
                    (batch_id, classification_id, target_library_id, execution_order)
                    VALUES ($1, $2, $3, $4)
                `, [batch.id, item.classificationId, item.targetLibraryId, i + 1]);
            }

            await client.query('COMMIT');

            logger.info('Created reclassification batch', { batchId: batch.id, itemCount: items.length });

            return this.getBatchStatus(batch.id);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Failed to create batch', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Validate all items in a batch before execution
     * @param {number} batchId - Batch ID
     * @returns {Promise<Object>} Validation results
     */
    async validateBatch(batchId) {
        await this.ensureTables();

        // Update batch status
        await db.query(`
            UPDATE reclassification_batches SET status = 'validating', updated_at = NOW()
            WHERE id = $1
        `, [batchId]);

        const itemsResult = await db.query(`
            SELECT * FROM reclassification_batch_items
            WHERE batch_id = $1
            ORDER BY execution_order
        `, [batchId]);

        const items = itemsResult.rows;
        let validCount = 0;
        let invalidCount = 0;

        for (const item of items) {
            try {
                // Run preview to validate
                const preview = await reclassificationService.previewReclassification({
                    classificationId: item.classification_id,
                    targetLibraryId: item.target_library_id
                });

                const isValid = preview.canProceed;
                const status = isValid ? 'validated' : 'invalid';

                await db.query(`
                    UPDATE reclassification_batch_items 
                    SET status = $1, validation_result = $2, error_message = $3, updated_at = NOW()
                    WHERE id = $4
                `, [status, JSON.stringify(preview), preview.warning || null, item.id]);

                if (isValid) {
                    validCount++;
                } else {
                    invalidCount++;
                }
            } catch (error) {
                await db.query(`
                    UPDATE reclassification_batch_items 
                    SET status = 'invalid', error_message = $1, updated_at = NOW()
                    WHERE id = $2
                `, [error.message, item.id]);
                invalidCount++;
            }
        }

        // Update batch status
        const finalStatus = invalidCount === 0 ? 'validated' : 'validation_failed';
        await db.query(`
            UPDATE reclassification_batches 
            SET status = $1, updated_at = NOW()
            WHERE id = $2
        `, [finalStatus, batchId]);

        logger.info('Batch validation complete', { batchId, validCount, invalidCount });

        return this.getBatchStatus(batchId);
    }

    /**
     * Execute a validated batch
     * @param {number} batchId - Batch ID
     * @returns {Promise<Object>} Execution results
     */
    async executeBatch(batchId) {
        await this.ensureTables();

        const batchResult = await db.query(`
            SELECT * FROM reclassification_batches WHERE id = $1
        `, [batchId]);

        if (batchResult.rows.length === 0) {
            throw new Error('Batch not found');
        }

        const batch = batchResult.rows[0];

        // Update batch status
        await db.query(`
            UPDATE reclassification_batches 
            SET status = 'executing', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
            WHERE id = $1
        `, [batchId]);

        // Get validated items to execute
        const itemsResult = await db.query(`
            SELECT * FROM reclassification_batch_items
            WHERE batch_id = $1 AND status IN ('validated', 'pending')
            ORDER BY execution_order
        `, [batchId]);

        const items = itemsResult.rows;
        let completedCount = batch.completed_items;
        let failedCount = batch.failed_items;

        for (const item of items) {
            // Update item status to executing
            await db.query(`
                UPDATE reclassification_batch_items 
                SET status = 'executing', updated_at = NOW()
                WHERE id = $1
            `, [item.id]);

            try {
                // Execute the actual reclassification
                const result = await reclassificationService.executeReclassification({
                    classificationId: item.classification_id,
                    targetLibraryId: item.target_library_id,
                    correctedBy: batch.created_by
                });

                if (result.success) {
                    completedCount++;
                    await db.query(`
                        UPDATE reclassification_batch_items 
                        SET status = 'completed', execution_result = $1, updated_at = NOW()
                        WHERE id = $2
                    `, [JSON.stringify(result), item.id]);

                    // Update batch progress
                    await db.query(`
                        UPDATE reclassification_batches 
                        SET completed_items = $1, updated_at = NOW()
                        WHERE id = $2
                    `, [completedCount, batchId]);
                } else {
                    throw new Error(result.error || 'Reclassification failed');
                }
            } catch (error) {
                failedCount++;
                await db.query(`
                    UPDATE reclassification_batch_items 
                    SET status = 'failed', error_message = $1, execution_result = $2, updated_at = NOW()
                    WHERE id = $3
                `, [error.message, JSON.stringify({ error: error.message }), item.id]);

                // Update batch progress
                await db.query(`
                    UPDATE reclassification_batches 
                    SET failed_items = $1, updated_at = NOW()
                    WHERE id = $2
                `, [failedCount, batchId]);

                // Check pause-on-error
                if (batch.pause_on_error) {
                    await db.query(`
                        UPDATE reclassification_batches 
                        SET status = 'paused', paused_at_item = $1, error_message = $2, updated_at = NOW()
                        WHERE id = $3
                    `, [item.execution_order, error.message, batchId]);

                    logger.warn('Batch paused due to error', { batchId, itemId: item.id, error: error.message });
                    return this.getBatchStatus(batchId);
                }
            }
        }

        // All items processed
        await db.query(`
            UPDATE reclassification_batches 
            SET status = 'completed', completed_at = NOW(), updated_at = NOW()
            WHERE id = $1
        `, [batchId]);

        logger.info('Batch execution complete', { batchId, completedCount, failedCount });

        return this.getBatchStatus(batchId);
    }

    /**
     * Pause a running batch
     * @param {number} batchId - Batch ID
     */
    async pauseBatch(batchId) {
        await db.query(`
            UPDATE reclassification_batches 
            SET status = 'paused', updated_at = NOW()
            WHERE id = $1 AND status = 'executing'
        `, [batchId]);

        return this.getBatchStatus(batchId);
    }

    /**
     * Resume a paused batch
     * @param {number} batchId - Batch ID
     */
    async resumeBatch(batchId) {
        return this.executeBatch(batchId);
    }

    /**
     * Cancel a batch and mark remaining items as cancelled
     * @param {number} batchId - Batch ID
     */
    async cancelBatch(batchId) {
        await db.query(`
            UPDATE reclassification_batch_items 
            SET status = 'cancelled', updated_at = NOW()
            WHERE batch_id = $1 AND status IN ('pending', 'validated')
        `, [batchId]);

        await db.query(`
            UPDATE reclassification_batches 
            SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
            WHERE id = $1
        `, [batchId]);

        return this.getBatchStatus(batchId);
    }

    /**
     * Skip a failed item and continue execution
     * @param {number} batchId - Batch ID
     * @param {number} itemId - Item ID to skip
     */
    async skipItem(batchId, itemId) {
        await db.query(`
            UPDATE reclassification_batch_items 
            SET status = 'skipped', updated_at = NOW()
            WHERE id = $1 AND batch_id = $2
        `, [itemId, batchId]);

        // Update skipped count
        await db.query(`
            UPDATE reclassification_batches 
            SET skipped_items = skipped_items + 1, updated_at = NOW()
            WHERE id = $1
        `, [batchId]);

        return this.getBatchStatus(batchId);
    }

    /**
     * Retry a failed item
     * @param {number} batchId - Batch ID
     * @param {number} itemId - Item ID to retry
     */
    async retryItem(batchId, itemId) {
        await db.query(`
            UPDATE reclassification_batch_items 
            SET status = 'validated', error_message = NULL, execution_result = NULL, updated_at = NOW()
            WHERE id = $1 AND batch_id = $2
        `, [itemId, batchId]);

        return this.getBatchStatus(batchId);
    }

    /**
     * Get full batch status with all items
     * @param {number} batchId - Batch ID
     */
    async getBatchStatus(batchId) {
        await this.ensureTables();

        const batchResult = await db.query(`
            SELECT * FROM reclassification_batches WHERE id = $1
        `, [batchId]);

        if (batchResult.rows.length === 0) {
            throw new Error('Batch not found');
        }

        const batch = batchResult.rows[0];

        const itemsResult = await db.query(`
            SELECT bi.*, ch.title, ch.media_type, 
                   orig_lib.name as original_library_name,
                   target_lib.name as target_library_name
            FROM reclassification_batch_items bi
            LEFT JOIN classification_history ch ON bi.classification_id = ch.id
            LEFT JOIN libraries orig_lib ON ch.library_id = orig_lib.id
            LEFT JOIN libraries target_lib ON bi.target_library_id = target_lib.id
            WHERE bi.batch_id = $1
            ORDER BY bi.execution_order
        `, [batchId]);

        return {
            ...batch,
            items: itemsResult.rows,
            progress: {
                total: batch.total_items,
                completed: batch.completed_items,
                failed: batch.failed_items,
                skipped: batch.skipped_items,
                remaining: batch.total_items - batch.completed_items - batch.failed_items - batch.skipped_items,
                percentage: batch.total_items > 0
                    ? Math.round((batch.completed_items / batch.total_items) * 100)
                    : 0
            }
        };
    }

    /**
     * Get progress only (lightweight for polling)
     * @param {number} batchId - Batch ID
     */
    async getBatchProgress(batchId) {
        await this.ensureTables();

        const result = await db.query(`
            SELECT id, status, total_items, completed_items, failed_items, skipped_items,
                   paused_at_item, error_message
            FROM reclassification_batches WHERE id = $1
        `, [batchId]);

        if (result.rows.length === 0) {
            throw new Error('Batch not found');
        }

        const batch = result.rows[0];
        return {
            batchId: batch.id,
            status: batch.status,
            progress: {
                total: batch.total_items,
                completed: batch.completed_items,
                failed: batch.failed_items,
                skipped: batch.skipped_items,
                remaining: batch.total_items - batch.completed_items - batch.failed_items - batch.skipped_items,
                percentage: batch.total_items > 0
                    ? Math.round((batch.completed_items / batch.total_items) * 100)
                    : 0
            },
            pausedAtItem: batch.paused_at_item,
            errorMessage: batch.error_message
        };
    }

    /**
     * List recent batches
     * @param {number} limit - Max batches to return
     */
    async listBatches(limit = 20) {
        await this.ensureTables();

        const result = await db.query(`
            SELECT * FROM reclassification_batches
            ORDER BY created_at DESC
            LIMIT $1
        `, [limit]);

        return result.rows.map(batch => ({
            ...batch,
            progress: {
                total: batch.total_items,
                completed: batch.completed_items,
                failed: batch.failed_items,
                skipped: batch.skipped_items,
                percentage: batch.total_items > 0
                    ? Math.round((batch.completed_items / batch.total_items) * 100)
                    : 0
            }
        }));
    }
}

module.exports = new ReclassificationBatchService();
