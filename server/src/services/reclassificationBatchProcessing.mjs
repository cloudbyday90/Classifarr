import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { NotFoundError } from '../utils/appError.mjs';

const logger = createLogger('ReclassificationBatchProcessing');

export async function validateBatch(batchId, { getReclassificationService }) {
    const reclassificationService = await getReclassificationService();

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

    const finalStatus = invalidCount === 0 ? 'validated' : 'validation_failed';
    await db.query(`
        UPDATE reclassification_batches 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
    `, [finalStatus, batchId]);

    logger.info('Batch validation complete', { batchId, validCount, invalidCount });
}

export async function executeBatch(batchId, { getReclassificationService, getBatchStatus }) {
    const batchResult = await db.query(`
        SELECT * FROM reclassification_batches WHERE id = $1
    `, [batchId]);

    if (batchResult.rows.length === 0) {
        throw new NotFoundError('Batch not found');
    }

    const batch = batchResult.rows[0];

    await db.query(`
        UPDATE reclassification_batches 
        SET status = 'executing', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
        WHERE id = $1
    `, [batchId]);

    const itemsResult = await db.query(`
        SELECT * FROM reclassification_batch_items
        WHERE batch_id = $1 AND status IN ('validated', 'pending')
        ORDER BY execution_order
    `, [batchId]);

    const items = itemsResult.rows;
    let completedCount = batch.completed_items;
    let failedCount = batch.failed_items;
    const reclassificationService = await getReclassificationService();

    for (const item of items) {
        await db.query(`
            UPDATE reclassification_batch_items 
            SET status = 'executing', updated_at = NOW()
            WHERE id = $1
        `, [item.id]);

        try {
            const result = await reclassificationService.executeReclassification({
                classificationId: item.classification_id,
                targetLibraryId: item.target_library_id,
                correctedBy: batch.created_by
            });

            completedCount++;
            await db.query(`
                UPDATE reclassification_batch_items 
                SET status = 'completed', execution_result = $1, updated_at = NOW()
                WHERE id = $2
            `, [JSON.stringify(result), item.id]);

            await db.query(`
                UPDATE reclassification_batches 
                SET completed_items = $1, updated_at = NOW()
                WHERE id = $2
            `, [completedCount, batchId]);
        } catch (error) {
            failedCount++;
            await db.query(`
                UPDATE reclassification_batch_items 
                SET status = 'failed', error_message = $1, execution_result = $2, updated_at = NOW()
                WHERE id = $3
            `, [error.message, JSON.stringify({ error: error.message }), item.id]);

            await db.query(`
                UPDATE reclassification_batches 
                SET failed_items = $1, updated_at = NOW()
                WHERE id = $2
            `, [failedCount, batchId]);

            if (batch.pause_on_error) {
                await db.query(`
                    UPDATE reclassification_batches 
                    SET status = 'paused', paused_at_item = $1, error_message = $2, updated_at = NOW()
                    WHERE id = $3
                `, [item.execution_order, error.message, batchId]);

                logger.warn('Batch paused due to error', { batchId, itemId: item.id, error: error.message });
                return getBatchStatus(batchId);
            }
        }
    }

    await db.query(`
        UPDATE reclassification_batches 
        SET status = 'completed', completed_at = NOW(), updated_at = NOW()
        WHERE id = $1
    `, [batchId]);

    logger.info('Batch execution complete', { batchId, completedCount, failedCount });

    return getBatchStatus(batchId);
}
