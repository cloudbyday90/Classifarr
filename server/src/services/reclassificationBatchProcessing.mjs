import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { AppError } from '../utils/appError.mjs';

const logger = createLogger('ReclassificationBatchProcessing');

export async function validateBatch(batchId, { getReclassificationService }) {
    const reclassificationService = await getReclassificationService();

    const claimed = await db.query(`
        UPDATE reclassification_batches SET status = 'validating', updated_at = NOW()
        WHERE id = $1 AND status IN ('pending', 'validating', 'validated', 'validation_failed') AND started_at IS NULL
        RETURNING id
    `, [batchId]);
    if (!claimed.rows.length) throw new AppError('Batch cannot be validated in its current state.', 409);

    const itemsResult = await db.query(`
        SELECT * FROM reclassification_batch_items
        WHERE batch_id = $1 AND status IN ('pending', 'validated', 'invalid')
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
                WHERE id = $4 AND status IN ('pending', 'validated', 'invalid')
                  AND EXISTS (SELECT 1 FROM reclassification_batches WHERE id = batch_id AND status = 'validating')
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
                WHERE id = $2 AND status IN ('pending', 'validated', 'invalid')
                  AND EXISTS (SELECT 1 FROM reclassification_batches WHERE id = batch_id AND status = 'validating')
            `, [error.message, item.id]);
            invalidCount++;
        }
    }

    const finalStatus = invalidCount === 0 ? 'validated' : 'validation_failed';
    await db.query(`
        UPDATE reclassification_batches 
        SET status = $1, updated_at = NOW()
        WHERE id = $2 AND status = 'validating'
    `, [finalStatus, batchId]);

    logger.info('Batch validation complete', { batchId, validCount, invalidCount });
}
