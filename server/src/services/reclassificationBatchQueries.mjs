import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { NotFoundError, ValidationError } from '../utils/appError.mjs';

const logger = createLogger('ReclassificationBatchQueries');

function computeProgress(batch) {
    const total = batch.total_items;
    const completed = batch.completed_items;
    const failed = batch.failed_items;
    const skipped = batch.skipped_items;
    return {
        total,
        completed,
        failed,
        skipped,
        remaining: total - completed - failed - skipped,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
}

export async function getBatchStatus(batchId) {
    const batchResult = await db.query(`
        SELECT * FROM reclassification_batches WHERE id = $1
    `, [batchId]);

    if (batchResult.rows.length === 0) {
        throw new NotFoundError('Batch not found');
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
        progress: computeProgress(batch)
    };
}

export async function getBatchProgress(batchId) {
    const result = await db.query(`
        SELECT id, status, total_items, completed_items, failed_items, skipped_items,
               paused_at_item, error_message
        FROM reclassification_batches WHERE id = $1
    `, [batchId]);

    if (result.rows.length === 0) {
        throw new NotFoundError('Batch not found');
    }

    const batch = result.rows[0];
    return {
        batchId: batch.id,
        status: batch.status,
        progress: computeProgress(batch),
        pausedAtItem: batch.paused_at_item,
        errorMessage: batch.error_message
    };
}

export async function listBatches(limit = 20) {
    const result = await db.query(`
        SELECT * FROM reclassification_batches
        ORDER BY created_at DESC
        LIMIT $1
    `, [limit]);

    return result.rows.map(batch => ({
        ...batch,
        progress: computeProgress(batch)
    }));
}

export async function createBatch(items, options = {}) {
    const { pauseOnError = true, createdBy = 'user' } = options;

    if (!Array.isArray(items) || items.length === 0) {
        throw new ValidationError('Items array is required and must not be empty');
    }

    const batch = await db.withTransaction(async (client) => {
        const batchResult = await client.query(`
            INSERT INTO reclassification_batches (status, total_items, pause_on_error, created_by)
            VALUES ('pending', $1, $2, $3)
            RETURNING *
        `, [items.length, pauseOnError, createdBy]);

        const inserted = batchResult.rows[0];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            await client.query(`
                INSERT INTO reclassification_batch_items 
                (batch_id, classification_id, target_library_id, execution_order)
                VALUES ($1, $2, $3, $4)
            `, [inserted.id, item.classificationId, item.targetLibraryId, i + 1]);
        }

        return inserted;
    });

    logger.info('Created reclassification batch', { batchId: batch.id, itemCount: items.length });

    return getBatchStatus(batch.id);
}

export async function pauseBatch(batchId, { getBatchStatus }) {
    await db.query(`
        UPDATE reclassification_batches 
        SET status = 'paused', updated_at = NOW()
        WHERE id = $1 AND status = 'executing'
    `, [batchId]);

    return getBatchStatus(batchId);
}

export async function cancelBatch(batchId, { getBatchStatus }) {
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

    return getBatchStatus(batchId);
}

export async function skipItem(batchId, itemId, { getBatchStatus }) {
    await db.query(`
        UPDATE reclassification_batch_items 
        SET status = 'skipped', updated_at = NOW()
        WHERE id = $1 AND batch_id = $2
    `, [itemId, batchId]);

    await db.query(`
        UPDATE reclassification_batches 
        SET skipped_items = skipped_items + 1, updated_at = NOW()
        WHERE id = $1
    `, [batchId]);

    return getBatchStatus(batchId);
}

export async function retryItem(batchId, itemId, { getBatchStatus }) {
    await db.query(`
        UPDATE reclassification_batch_items 
        SET status = 'validated', error_message = NULL, execution_result = NULL, updated_at = NOW()
        WHERE id = $1 AND batch_id = $2
    `, [itemId, batchId]);

    return getBatchStatus(batchId);
}
