import { parsePayload } from '../utils/queueHelpers.mjs';

export async function processRatingNormalization(task, { db, logger, completeTask, ratingNormalizer }) {
    const payload = parsePayload(task.payload);
    const { media_item_id } = payload;

    let skipped = false;
    let originalRating, normalizedRating;

    try {
        await db.withTransaction(async (client) => {
            await client.query("SET LOCAL statement_timeout = '30000'");

            const result = await client.query(`
                SELECT id, content_rating, metadata, media_type
                FROM media_server_items WHERE id = $1
            `, [media_item_id]);

            if (result.rows.length === 0) {
                skipped = true;
            } else {
                const item = result.rows[0];
                originalRating = item.content_rating;
                normalizedRating = ratingNormalizer.getPriorityRating(item);

                await client.query(`
                    UPDATE media_server_items
                    SET original_rating = COALESCE(original_rating, $2), 
                        content_rating = $3, 
                        last_synced = NOW()
                    WHERE id = $1
                `, [media_item_id, originalRating, normalizedRating]);
            }
        });
    } catch (error) {
        logger.error('Rating normalization failed', {
            itemId: media_item_id,
            error: error.message
        });
        throw error;
    }

    if (skipped) {
        await completeTask(task.id, { skipped: true, reason: 'Item not found' });
        return;
    }

    if (normalizedRating !== originalRating) {
        logger.info('Rating normalized', {
            itemId: media_item_id,
            original: originalRating,
            normalized: normalizedRating
        });

        await completeTask(task.id, {
            normalized: true,
            original: originalRating,
            new: normalizedRating
        });
        return;
    }

    logger.debug('Rating already standard', {
        itemId: media_item_id,
        rating: originalRating
    });

    await completeTask(task.id, {
        normalized: false,
        reason: 'Rating already standard',
        rating: originalRating
    });
}
